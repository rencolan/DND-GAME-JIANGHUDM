import { Backpack, Map as MapIcon, Settings, User, Users, X } from "lucide-react";
import type { ReactNode } from "react";
import type { DrawerTab } from "../../types";

type DrawerPanelProps = {
  drawerOpen: boolean;
  activeTab: DrawerTab;
  onSelectTab: (tab: DrawerTab) => void;
  onClose: () => void;
  children: ReactNode;
};

const tabItems: Array<{ id: DrawerTab; label: string; icon: typeof User }> = [
  { id: "character", label: "状态", icon: User },
  { id: "inventory", label: "行囊", icon: Backpack },
  { id: "party", label: "同伴", icon: Users },
  { id: "map", label: "地图", icon: MapIcon },
  { id: "system", label: "系统", icon: Settings }
];

export function DrawerPanel({ drawerOpen, activeTab, onSelectTab, onClose, children }: DrawerPanelProps) {
  if (!drawerOpen) return null;

  return (
    <aside className="drawer open">
      <div className="drawer-handle" />
      <div className="drawer-tabs">
        {tabItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={activeTab === item.id ? "active" : ""}
              onClick={() => onSelectTab(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button className="close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="drawer-content">{children}</div>
    </aside>
  );
}
