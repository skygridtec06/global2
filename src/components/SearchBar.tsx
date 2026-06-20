import { useState } from "react";
import { Search, X } from "lucide-react";
import { motion } from "framer-motion";

interface SearchBarProps {
  value: string;
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onSearch, placeholder = "Search teams or matches..." }: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div
      layout
      className="relative"
    >
      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
        isFocused
          ? "border-accent bg-card shadow-lg"
          : "border-border bg-muted/50"
      }`}>
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
        {value && (
          <button
            onClick={() => onSearch("")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
