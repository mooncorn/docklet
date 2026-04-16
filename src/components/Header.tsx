"use client";

import { useState, useRef, useEffect } from "react";
import { HiOutlineBars3, HiOutlineUser, HiOutlineArrowRightOnRectangle } from "react-icons/hi2";

interface HeaderProps {
  username?: string;
  onMenuToggle: () => void;
  onLogout: () => void;
}

export default function Header({ username, onMenuToggle, onLogout }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-14 bg-gray-800 border-b border-gray-700 px-4 flex items-center justify-between">
      <button
        onClick={onMenuToggle}
        className="lg:hidden text-gray-400 hover:text-white p-1"
        aria-label="Toggle menu"
      >
        <HiOutlineBars3 className="w-6 h-6" />
      </button>

      <div className="flex-1" />

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
        >
          <HiOutlineUser className="w-5 h-5" />
          <span className="text-sm hidden sm:inline">{username}</span>
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 z-50">
            <div className="px-4 py-2 text-sm text-gray-400 border-b border-gray-700">
              Signed in as <span className="text-white font-medium">{username}</span>
            </div>
            <button
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              <HiOutlineArrowRightOnRectangle className="w-4 h-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
