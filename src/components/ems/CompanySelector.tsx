import { useCompany } from "@/contexts/CompanyContext";
import { Building2, ChevronDown, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

const COMPANY_COLOR_MAP: Record<string, string> = {
  primary: "bg-primary",
  blue: "bg-blue-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
  red: "bg-red-500",
  pink: "bg-pink-500",
  cyan: "bg-cyan-500",
};

interface CompanySelectorProps {
  collapsed?: boolean;
}

export const CompanySelector = ({ collapsed = false }: CompanySelectorProps) => {
  const { companies, selectedCompanyId, setSelectedCompanyId, selectedCompany } = useCompany();
  const navigate = useNavigate();

  const getColor = (color: string | null) => COMPANY_COLOR_MAP[color || "primary"] || "bg-primary";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-sidebar-hover",
            collapsed ? "justify-center" : ""
          )}
        >
          {selectedCompany ? (
            <div className={cn("h-6 w-6 rounded-md flex-shrink-0 flex items-center justify-center", getColor(selectedCompany.color))}>
              <Building2 className="h-3.5 w-3.5 text-white" />
            </div>
          ) : (
            <div className="h-6 w-6 rounded-md flex-shrink-0 flex items-center justify-center bg-muted">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          )}
          {!collapsed && (
            <>
              <span className="text-xs font-medium text-foreground truncate flex-1">
                {selectedCompany?.name || "Todas as empresas"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={() => setSelectedCompanyId("all")} className="gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span>Todas as empresas</span>
          {selectedCompanyId === "all" && <span className="ml-auto text-primary text-xs">●</span>}
        </DropdownMenuItem>
        {companies.length > 0 && <DropdownMenuSeparator />}
        {companies.map((company) => (
          <DropdownMenuItem key={company.id} onClick={() => setSelectedCompanyId(company.id)} className="gap-2">
            <div className={cn("h-4 w-4 rounded flex-shrink-0 flex items-center justify-center", getColor(company.color))}>
              <Building2 className="h-2.5 w-2.5 text-white" />
            </div>
            <span className="truncate">{company.name}</span>
            {selectedCompanyId === company.id && <span className="ml-auto text-primary text-xs">●</span>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/ems/companies")} className="gap-2 text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>Gerenciar empresas</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
