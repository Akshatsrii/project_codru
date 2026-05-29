import { useState, useEffect, useRef } from "react";
import { Search, Loader2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const GlobalSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch results as user types
  useEffect(() => {
    const fetchUsers = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_API}search-users?q=${query}`);
        const data = await res.json();
        setResults(data);
        setIsOpen(true);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchUsers, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (username: string) => {
    setQuery("");
    setIsOpen(false);
    navigate(`/profile/${username}`);
  };

  return (
    <div className="relative w-full max-w-md mx-4" ref={searchRef}>
      {/* Input Field */}
      <div className="relative group">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isOpen ? 'text-brand-blue' : 'text-gray-400'}`} />
        <input
          type="text"
          placeholder="Search creators..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          className="w-full pl-10 pr-10 py-2.5 bg-slate-100 border-none rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-1000">
          {isLoading ? (
            <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-orange" /></div>
          ) : results.length > 0 ? (
            <div className="max-h-75 overflow-y-auto">
              {results.map((user) => (
                <div 
                  key={user._id}
                  onClick={() => handleSelect(user.username)}
                  className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors border-b border-gray-50 last:border-none"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-orange/10 flex items-center justify-center shrink-0">
                    {user.photo ? (
                      <img src={user.photo} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-brand-orange font-bold text-xs">{user.name?.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-800">@{user.username}</span>
                    <span className="text-xs text-gray-500">{user.name}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : query.length >= 2 && (
            <div className="p-4 text-center text-sm text-gray-400 italic">No explorers found.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;