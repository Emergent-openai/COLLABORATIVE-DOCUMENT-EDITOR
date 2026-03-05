import { motion } from "framer-motion";
import {
  AlignLeft,
  Bold,
  ChevronDown,
  Eye,
  FileText,
  History,
  Italic,
  LayoutGrid,
  List,
  MessageSquareText,
  Quote,
  Redo2,
  Share2,
  Underline,
  Undo2,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const topMenus = [
  {
    id: "file",
    label: "File",
    items: [
      { id: "new-document", label: "New document" },
      { id: "save-document", label: "Save now" },
      { id: "print-document", label: "Print" },
      { separator: true },
      { id: "insert-paragraph", label: "New paragraph block" },
      { id: "insert-heading", label: "New heading block" },
      { id: "insert-quote", label: "New quote block" },
      { id: "insert-list", label: "New list block" },
      { separator: true },
      { id: "duplicate-block", label: "Duplicate selected block" },
      { id: "delete-block", label: "Delete selected block" },
      { separator: true },
      { id: "share-document", label: "Share document" },
    ],
  },
  {
    id: "edit",
    label: "Edit",
    items: [
      { id: "undo", label: "Undo" },
      { id: "redo", label: "Redo" },
      { separator: true },
      { id: "copy-block", label: "Copy selected block" },
      { id: "paste-block", label: "Paste after selected block" },
      { id: "cut-block", label: "Cut selected block" },
      { separator: true },
      { id: "format-bold", label: "Bold selection" },
      { id: "format-italic", label: "Italicize selection" },
      { id: "format-underline", label: "Underline selection" },
      { separator: true },
      { id: "trigger-ai", label: "Generate inline suggestion" },
    ],
  },
  {
    id: "view",
    label: "View",
    items: [
      { id: "open-outline", label: "Open outline" },
      { id: "open-comments", label: "Open comments" },
      { id: "open-history", label: "Open version history" },
      { id: "collapse-panels", label: "Hide side panels" },
      { separator: true },
      { id: "toggle-demo", label: "Preview collaboration" },
    ],
  },
  {
    id: "insert",
    label: "Insert",
    items: [
      { id: "insert-heading", label: "Heading" },
      { id: "insert-paragraph", label: "Paragraph" },
      { id: "insert-quote", label: "Quote" },
      { id: "insert-list", label: "Bulleted list" },
    ],
  },
  {
    id: "format",
    label: "Format",
    items: [
      { id: "set-type-paragraph", label: "Normal text" },
      { id: "set-type-heading", label: "Heading" },
      { id: "set-type-quote", label: "Quote" },
      { id: "set-type-list", label: "List" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      { id: "trigger-ai", label: "Improve with AI" },
      { id: "open-comments", label: "Open comments" },
      { id: "open-history", label: "Open version history" },
    ],
  },
];

const blockTypeLabels = {
  paragraph: "Normal text",
  heading: "Heading",
  quote: "Quote",
  list: "List",
  divider: "Divider",
};

const fontOptions = ["Inter", "Work Sans"];
const fontSizeOptions = [12, 14, 16, 18, 20];
const zoomOptions = [90, 100, 110, 125];

function MenuDropdown({ menu, onAction }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-md px-2 py-1 text-sm text-slate-600 transition-colors hover:bg-slate-100"
          data-testid={`header-menu-${menu.id}-button`}
          type="button"
        >
          {menu.label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56" data-testid={`header-menu-${menu.id}-content`}>
        {menu.items.map((item, index) =>
          item.separator ? (
            <DropdownMenuSeparator key={`${menu.id}-separator-${index}`} />
          ) : (
            <DropdownMenuItem
              data-testid={`header-menu-item-${menu.id}-${item.id}`}
              key={item.id}
              onClick={() => onAction(item.id)}
            >
              {item.label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ToolbarDropdown({
  id,
  label,
  options,
  onSelect,
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-[#D3E3FD]"
          data-testid={`toolbar-button-${id}`}
          type="button"
        >
          <span>{label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44" data-testid={`toolbar-dropdown-${id}`}>
        {options.map((option) => (
          <DropdownMenuItem
            data-testid={`toolbar-dropdown-item-${id}-${String(option.value).toLowerCase().replace(/\s+/g, "-")}`}
            key={`${id}-${option.value}`}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ToolbarIconButton({ active = false, icon: Icon, id, label, onClick }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md p-2 transition-colors ${
        active ? "bg-[#D3E3FD] text-[#174EA6]" : "text-slate-700 hover:bg-[#D3E3FD]"
      }`}
      data-testid={`toolbar-button-${id}`}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export default function EditorHeader({
  activePageId,
  activePanel,
  connectionState,
  demoActive,
  documentTitle,
  isRenamingTitle,
  isSavingTitle,
  isPublished,
  onMenuAction,
  onPublish,
  onRenameCancel,
  onRenameChange,
  onRenameSave,
  onRenameStart,
  onSelectPage,
  onToggleDemo,
  onTogglePanel,
  onToolbarAction,
  pages,
  participants,
  shareCopied,
  titleDraft,
  toolbarState,
}) {
  const typeLabel = blockTypeLabels[toolbarState.activeType] || "Normal text";

  return (
    <motion.header
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm"
      data-testid="editor-header"
      initial={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.18 }}
    >
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-3 px-4 py-3 lg:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.7rem] bg-[#1A73E8] text-white shadow-sm">
              <FileText className="h-5 w-5" />
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {isRenamingTitle ? (
                  <input
                    autoFocus
                    className="min-w-[14rem] max-w-[26rem] rounded-md border border-[#1A73E8] bg-white px-2 py-1 text-[18px] font-medium text-slate-900 outline-none ring-2 ring-[#D2E3FC]"
                    data-testid="editor-document-title-input"
                    onBlur={(event) => onRenameSave(event.target.value)}
                    onChange={(event) => onRenameChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        onRenameSave(event.currentTarget.value);
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        onRenameCancel();
                      }
                    }}
                    value={titleDraft}
                  />
                ) : (
                  <button
                    className="truncate rounded-md px-1 py-0.5 text-left text-[18px] font-medium text-slate-900 transition-colors hover:bg-slate-100"
                    data-testid="editor-document-title-button"
                    onClick={onRenameStart}
                    style={{ fontFamily: '"Work Sans", sans-serif' }}
                    type="button"
                  >
                    {documentTitle}
                  </button>
                )}
                <span
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500"
                  data-testid="editor-connection-status"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      connectionState === "connected"
                        ? "bg-emerald-500"
                        : connectionState === "connecting"
                          ? "bg-amber-400"
                          : "bg-rose-400"
                    }`}
                  />
                  {connectionState === "connected"
                    ? "All changes saved"
                    : connectionState === "connecting"
                      ? "Connecting"
                      : "Reconnecting"}
                </span>
                {isSavingTitle ? (
                  <span className="rounded-md bg-[#E8F0FE] px-2 py-1 text-[11px] font-medium text-[#174EA6]" data-testid="editor-document-title-saving">
                    Saving file name...
                  </span>
                ) : null}
                <span className="max-w-[14rem] truncate rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500" data-testid="editor-active-page-badge">
                  {pages.find((page) => page.id === activePageId)?.title || "Shared page"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {topMenus.map((menu) => (
                  <MenuDropdown key={menu.id} menu={menu} onAction={onMenuAction} />
                ))}
              </div>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
            <Button
              className={`rounded-md border border-slate-200 px-3 text-slate-700 hover:bg-slate-50 ${
                demoActive ? "bg-slate-100" : "bg-white"
              }`}
              data-testid="toggle-collab-demo-button"
              onClick={onToggleDemo}
              type="button"
              variant="secondary"
            >
              <UsersRound className="mr-2 h-4 w-4" />
              {demoActive ? "Stop demo" : "Preview collaboration"}
            </Button>

            <Link data-testid="published-view-link" to="/published">
              <Button className="rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" type="button" variant="secondary">
                <Eye className="mr-2 h-4 w-4" />
                Published
              </Button>
            </Link>

            <Button
              className="rounded-md bg-[#1A73E8] px-4 text-white hover:bg-[#1557B0]"
              data-testid="share-publish-button"
              onClick={() => onPublish()}
              type="button"
            >
              <Share2 className="mr-2 h-4 w-4" />
              {isPublished ? (shareCopied ? "Link copied" : "Share") : "Share"}
            </Button>

            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1.5">
              <div className="flex -space-x-2">
                {participants.slice(0, 4).map((participant) => (
                  <Avatar
                    className="h-7 w-7 border-2 border-white"
                    data-testid={`participant-avatar-${participant.session_id}`}
                    key={participant.session_id}
                  >
                    <AvatarImage alt={participant.name} src={participant.avatar_url} />
                    <AvatarFallback>{participant.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <p className="text-sm font-medium text-slate-700" data-testid="participant-count-label">
                {participants.length} active
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto no-scrollbar" data-testid="editor-toolbar">
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-[#EDF2FA] px-2 py-1" data-testid="toolbar-group-history">
              <ToolbarIconButton icon={Undo2} id="undo" label="Undo" onClick={() => onToolbarAction("undo")} />
              <ToolbarIconButton icon={Redo2} id="redo" label="Redo" onClick={() => onToolbarAction("redo")} />
            </div>

            <div className="flex shrink-0 items-center gap-1 rounded-full bg-[#EDF2FA] px-2 py-1" data-testid="toolbar-group-layout">
              <ToolbarDropdown
                id="zoom"
                label={`${toolbarState.zoomLevel}%`}
                onSelect={(value) => onToolbarAction("set-zoom", value)}
                options={zoomOptions.map((value) => ({ label: `${value}%`, value }))}
              />
              <ToolbarDropdown
                id="style"
                label={typeLabel}
                onSelect={(value) => onToolbarAction("set-type", value)}
                options={[
                  { label: "Normal text", value: "paragraph" },
                  { label: "Heading", value: "heading" },
                  { label: "Quote", value: "quote" },
                  { label: "List", value: "list" },
                ]}
              />
              <ToolbarDropdown
                id="font"
                label={toolbarState.fontFamily}
                onSelect={(value) => onToolbarAction("set-font", value)}
                options={fontOptions.map((value) => ({ label: value, value }))}
              />
              <ToolbarDropdown
                id="font-size"
                label={String(toolbarState.fontSize)}
                onSelect={(value) => onToolbarAction("set-size", value)}
                options={fontSizeOptions.map((value) => ({ label: `${value}`, value }))}
              />
            </div>

            <div className="flex shrink-0 items-center gap-1 rounded-full bg-[#EDF2FA] px-2 py-1" data-testid="toolbar-group-formatting">
              <ToolbarIconButton
                active={toolbarState.activeStyles.includes("bold")}
                icon={Bold}
                id="bold"
                label="Bold"
                onClick={() => onToolbarAction("toggle-style", "bold")}
              />
              <ToolbarIconButton
                active={toolbarState.activeStyles.includes("italic")}
                icon={Italic}
                id="italic"
                label="Italic"
                onClick={() => onToolbarAction("toggle-style", "italic")}
              />
              <ToolbarIconButton
                active={toolbarState.activeStyles.includes("underline")}
                icon={Underline}
                id="underline"
                label="Underline"
                onClick={() => onToolbarAction("toggle-style", "underline")}
              />
            </div>

            <div className="flex shrink-0 items-center gap-1 rounded-full bg-[#EDF2FA] px-2 py-1" data-testid="toolbar-group-insert">
              <ToolbarIconButton
                icon={AlignLeft}
                id="normal-text"
                label="Normal text"
                onClick={() => onToolbarAction("set-type", "paragraph")}
              />
              <ToolbarIconButton
                icon={Quote}
                id="quote"
                label="Quote"
                onClick={() => onToolbarAction("set-type", "quote")}
              />
              <ToolbarIconButton
                icon={List}
                id="list"
                label="List"
                onClick={() => onToolbarAction("set-type", "list")}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-end xl:pl-20">
            <div className="flex flex-wrap gap-1.5" data-testid="editor-page-navigation">
              {pages.map((page) => (
                <button
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    activePageId === page.id
                      ? "bg-[#E8F0FE] text-[#174EA6]"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                  data-testid={`page-switch-button-${page.id}`}
                  key={page.id}
                  onClick={() => onSelectPage(page.id)}
                  type="button"
                >
                  {page.title}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5" data-testid="editor-panel-navigation">
              {[
                { id: "overview", label: "Outline", icon: LayoutGrid },
                { id: "comments", label: "Comments", icon: MessageSquareText },
                { id: "history", label: "Version history", icon: History },
              ].map((panel) => {
                const Icon = panel.icon;
                const isActive = activePanel === panel.id;

                return (
                  <button
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#E8F0FE] text-[#174EA6]"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    data-testid={`toggle-${panel.id}-panel-button`}
                    key={panel.id}
                    onClick={() => onTogglePanel(panel.id)}
                    type="button"
                  >
                    <Icon className="h-4 w-4" />
                    {panel.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}