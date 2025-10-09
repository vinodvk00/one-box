import { Mail, Search, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import UserMenu from "@/components/layout/UserMenu";

export function Header() {
  const navigate = useNavigate();

  return (
    <header className="h-16 bg-background border-b border-border flex items-center justify-between px-6">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate("/")}>
          <Mail className="h-8 w-8 text-blue-600" />
          <h1 className="text-xl font-semibold text-foreground">OneMail</h1>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/search")}>
          <Search className="h-5 w-5" />
        </Button>
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
          <Settings className="h-5 w-5" />
        </Button>
        <UserMenu />
      </div>
    </header>
  );
}
