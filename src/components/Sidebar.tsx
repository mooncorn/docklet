"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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
  { label: "Containers", href: "/containers", icon: <HiOutlineCube className="w-5 h-5" /> },
  { label: "Images", href: "/images", icon: <HiOutlinePhoto className="w-5 h-5" /> },
  { label: "Files", href: "/files", icon: <HiOutlineFolder className="w-5 h-5" /> },
  { label: "Users", href: "/users", icon: <HiOutlineUsers className="w-5 h-5" />, adminOnly: true },
  { label: "Settings", href: "/settings", icon: <HiOutlineCog6Tooth className="w-5 h-5" />, adminOnly: true },
];

interface SidebarProps {
  userRole?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ userRole, isOpen, onClose }: SidebarProps) {
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
        className={`sidebar fixed lg:relative z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-4 border-b border-gray-700">
          <Link href="/containers" className="text-xl font-bold text-white">
            Docklet
          </Link>
        </div>

        <nav className="p-3 space-y-1">
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
