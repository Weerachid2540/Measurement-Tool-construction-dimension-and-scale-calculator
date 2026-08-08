import type { PanelTab } from '@/store';
import { useUiStore } from '@/store';
import { Icon, type IconName } from '@/components/common';
import { MeasurementList } from './MeasurementList';
import { PropertiesPanel } from './PropertiesPanel';
import { BoqPanel } from './BoqPanel';
import { HistoryPanel } from './HistoryPanel';
import { AutoCountPanel } from './AutoCountPanel';

const TABS: { id: PanelTab; label: string; icon: IconName }[] = [
  { id: 'measurements', label: 'รายการวัด', icon: 'list' },
  { id: 'properties', label: 'คุณสมบัติ', icon: 'settings' },
  { id: 'autoCount', label: 'นับอัตโนมัติ', icon: 'count' },
  { id: 'boq', label: 'BOQ', icon: 'table' },
  { id: 'history', label: 'ประวัติ', icon: 'history' },
];

export function SidePanel() {
  const panelTab = useUiStore((s) => s.panelTab);
  const setPanelTab = useUiStore((s) => s.setPanelTab);
  const panelOpen = useUiStore((s) => s.panelOpen);
  const togglePanel = useUiStore((s) => s.togglePanel);

  return (
    <aside className={`mt-panel ${panelOpen ? '' : 'is-collapsed'}`} aria-label="แผงข้อมูล">
      <div className="mt-panel__tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={panelTab === tab.id}
            className={`mt-panel__tab ${panelTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setPanelTab(tab.id)}
          >
            <Icon name={tab.icon} size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
        <button
          type="button"
          className="mt-panel__collapse"
          onClick={togglePanel}
          aria-label={panelOpen ? 'ย่อแผง' : 'ขยายแผง'}
          title={panelOpen ? 'ย่อแผง' : 'ขยายแผง'}
        >
          <Icon name={panelOpen ? 'chevronRight' : 'chevronLeft'} size={18} />
        </button>
      </div>

      {panelOpen && (
        <div className="mt-panel__content" role="tabpanel">
          {panelTab === 'measurements' && <MeasurementList />}
          {panelTab === 'properties' && <PropertiesPanel />}
          {panelTab === 'autoCount' && <AutoCountPanel />}
          {panelTab === 'boq' && <BoqPanel />}
          {panelTab === 'history' && <HistoryPanel />}
        </div>
      )}
    </aside>
  );
}
