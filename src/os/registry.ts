import type { AppId } from "@/state/store";
import CoreApp from "@/os/apps/Core";
import ModulesApp from "@/os/apps/Modules";
import ToolsApp from "@/os/apps/Tools";
import AIApp from "@/os/apps/AI";
import ShareApp from "@/os/apps/Share";
import GamesApp from "@/os/apps/Games";
import TerminalApp from "@/os/apps/Terminal";
import AdminApp from "@/os/apps/Admin";
import NotesApp from "@/os/apps/Notes";
import MusicApp from "@/os/apps/Music";
import BrowserApp from "@/os/apps/Browser";
import HelpApp from "@/os/apps/Help";

export const REGISTRY: Record<AppId, () => React.JSX.Element> = {
  core: CoreApp,
  modules: ModulesApp,
  tools: ToolsApp,
  ai: AIApp,
  share: ShareApp,
  games: GamesApp,
  terminal: TerminalApp,
  admin: AdminApp,
  notes: NotesApp,
  music: MusicApp,
  browser: BrowserApp,
  help: HelpApp,
};
