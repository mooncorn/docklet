"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HiOutlineHome,
  HiOutlineCube,
  HiOutlinePhoto,
  HiOutlineFolder,
  HiOutlineUsers,
  HiOutlineCog6Tooth,
} from "react-icons/hi2";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <HiOutlineHome className="w-5 h-5" /> },
  { label: "Containers", href: "/containers", icon: <HiOutlineCube className="w-5 h-5" /> },
  { label: "Images", href: "/images", icon: <HiOutlinePhoto className="w-5 h-5" /> },
  { label: "Files", href: "/files", icon: <HiOutlineFolder className="w-5 h-5" /> },
  { label: "Users", href: "/users", icon: <HiOutlineUsers className="w-5 h-5" />, adminOnly: true },
  { label: "Settings", href: "/settings", icon: <HiOutlineCog6Tooth className="w-5 h-5" />, adminOnly: true },
];

interface SidebarProps {
  userRole?: string;
  appName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ userRole, appName = "Docklet", isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const filteredItems = navItems.filter(
    (item) => !item.adminOnly || userRole === "admin"
  );

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`sidebar fixed inset-y-0 lg:relative lg:inset-y-auto z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-14 px-4 border-b border-gray-700 flex items-center">
          <Link href="/dashboard" className="text-xl font-bold text-white">
            {appName}
          </Link>
        </div>

        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {filteredItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`nav-link ${isActive ? "nav-link-active" : "nav-link-inactive"}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
