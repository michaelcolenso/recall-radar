import Link from "next/link";
import { SearchBar } from "./search-bar";
import { ShieldCheck } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg text-gray-900 shrink-0"
        >
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          RecallRadar
        </Link>
        <div className="flex-1 flex justify-center sm:justify-end">
          <SearchBar />
        </div>
      </div>
    </header>
  );
}
