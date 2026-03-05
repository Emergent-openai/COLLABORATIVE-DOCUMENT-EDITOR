import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import { LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import CollaboratorCursor from "@/components/editor/CollaboratorCursor";
import CommentRail from "@/components/editor/CommentRail";
import ConfettiBurst from "@/components/editor/ConfettiBurst";
import EditorBlock from "@/components/editor/EditorBlock";
import EditorHeader from "@/components/editor/EditorHeader";
import PresenceMinimap from "@/components/editor/PresenceMinimap";
import SlashCommandPalette from "@/components/editor/SlashCommandPalette";
import VersionTimeline from "@/components/editor/VersionTimeline";
import {
  buildAiSuggestion,
  buildNewBlock,
  buildPublishedUrl,
  blockPlaceholders,
  collaboratorAvatars,
  collaboratorColors,
  commandOptions,
  createLocalSession,
  toWebSocketUrl,
} from "@/components/editor/editorConfig";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const WS_URL = toWebSocketUrl(process.env.REACT_APP_BACKEND_URL);

function replacePageBlocks(allBlocks, pages, pageId, nextPageBlocks) {
  return pages.flatMap((page) =>
    page.id === pageId ? nextPageBlocks : allBlocks.filter((block) => block.page_id === page.id),
  );
}

function cloneBlocks(blocks = []) {
  return blocks.map((block) => ({
    ...block,
    styles: Array.isArray(block.styles) ? [...block.styles] : [],
  }));
}

function buildBlocksFingerprint(blocks = []) {
  return JSON.stringify(
    blocks.map((block) => ({
      id: block.id,
      page_id: block.page_id,
      type: block.type,
      content: block.content,
      annotation: block.annotation,
      placeholder: block.placeholder,
      styles: block.styles || [],
      font_family: block.font_family || "Inter",
      font_size: block.font_size || 14,
    })),
  );
}

const DEMO_COLLABORATORS = [
  {
    session_id: "demo-avery-chen",
    name: "Avery Chen",
    color: collaboratorColors[1],
    avatar_url: collaboratorAvatars[1] || collaboratorAvatars[0],
  },
  {
    session_id: "demo-rowan-park",
    name: "Rowan Park",
    color: collaboratorColors[2],
    avatar_url: collaboratorAvatars[2] || collaboratorAvatars[0],
  },
];

function createDemoParticipant(baseParticipant, overrides) {
  return {
    ...baseParticipant,
    cursor: {
      x: overrides.x ?? 220,
      y: overrides.y ?? 220,
    },
    active_page: overrides.active_page,
    position_ratio: overrides.position_ratio ?? 0.2,
    active_block_id: overrides.active_block_id ?? "",
    is_typing: overrides.is_typing ?? false,
    joined_at: overrides.joined_at ?? new Date().toISOString(),
  };
}

function createDemoTypingPreview(baseParticipant, overrides) {
  return {
    session_id: baseParticipant.session_id,
    name: baseParticipant.name,
    color: baseParticipant.color,
    avatar_url: baseParticipant.avatar_url,
    block_id: overrides.block_id,
    page_id: overrides.page_id,
    content: overrides.content,
    updated_at: new Date().toISOString(),
  };
}

export default function EditorWorkspace() {
  const session = useMemo(() => createLocalSession(), []);
  const [documentData, setDocumentData] = useState(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [typingPreviews, setTypingPreviews] = useState([]);
  const [activePageId, setActivePageId] = useState("page-1");
  const [activeBlockId, setActiveBlockId] = useState("");
  const [selectedBlockIds, setSelectedBlockIds] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [connectionState, setConnectionState] = useState("connecting");
  const [slashState, setSlashState] = useState({
    open: false,
    blockId: "",
    query: "",
    selectedIndex: 0,
  });
  const [aiState, setAiState] = useState({ blockId: "", suggestion: "" });
  const [suppressedSuggestionMap, setSuppressedSuggestionMap] = useState({});
  const [dragState, setDragState] = useState({ draggingId: "", targetId: "", position: "after" });
  const [selectionGlow, setSelectionGlow] = useState(null);
  const [focusFlashId, setFocusFlashId] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [demoParticipants, setDemoParticipants] = useState([]);
  const [demoTypingPreviews, setDemoTypingPreviews] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [copiedBlock, setCopiedBlock] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(100);

  const pageRef = useRef(null);
  const scrollRef = useRef(null);
  const blockRefs = useRef({});
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const demoIntervalRef = useRef(null);
  const manualCloseRef = useRef(false);
  const titleSaveInFlightRef = useRef(false);
  const latestBlocksRef = useRef([]);
  const commitTimersRef = useRef({});
  const lastPointerRef = useRef(0);
  const selectionAnchorRef = useRef("");

  const clearPendingCommits = () => {
    Object.values(commitTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    commitTimersRef.current = {};
  };

  useEffect(() => {
    let mounted = true;

    const fetchDocument = async () => {
      try {
        const response = await axios.get(`${API}/document`);
        if (!mounted) {
          return;
        }

        setDocumentData(response.data);
        latestBlocksRef.current = response.data.blocks || [];
        setActivePageId(response.data.pages?.[0]?.id || "page-1");
        setUndoStack([]);
        setRedoStack([]);
      } catch (error) {
        console.error(error);
        toast.error("Could not load the shared document.");
      }
    };

    fetchDocument();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const connect = () => {
      manualCloseRef.current = false;
      const params = new URLSearchParams({
        session_id: session.session_id,
        name: session.name,
        color: session.color,
        avatar_url: session.avatar_url,
      });

      setConnectionState("connecting");
      const socket = new WebSocket(`${WS_URL}?${params.toString()}`);
      wsRef.current = socket;

      socket.onopen = () => {
        setConnectionState("connected");
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === "snapshot") {
          setDocumentData(message.document);
          latestBlocksRef.current = message.document.blocks || [];
          setParticipants(message.participants || []);
          setTypingPreviews(message.typing_previews || []);
          setUndoStack([]);
          setRedoStack([]);
          if (!activePageId) {
            setActivePageId(message.document.pages?.[0]?.id || "page-1");
          }
        }

        if (message.type === "presence_sync") {
          setParticipants(message.participants || []);
        }

        if (message.type === "typing_sync") {
          setTypingPreviews(message.typing_previews || []);
          if (message.participants) {
            setParticipants(message.participants);
          }
        }

        if (message.type === "document_sync") {
          setDocumentData(message.document);
          latestBlocksRef.current = message.document.blocks || [];
          if (message.participants) {
            setParticipants(message.participants);
          }
          if (message.typing_previews) {
            setTypingPreviews(message.typing_previews);
          }
        }
      };

      socket.onclose = () => {
        if (manualCloseRef.current) {
          return;
        }
        setConnectionState("reconnecting");
        reconnectRef.current = window.setTimeout(connect, 1600);
      };
    };

    connect();

    return () => {
      manualCloseRef.current = true;
      window.clearTimeout(reconnectRef.current);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [session.avatar_url, session.color, session.name, session.session_id]);

  useEffect(() => () => {
    clearPendingCommits();
  }, []);

  useEffect(() => () => {
    window.clearInterval(demoIntervalRef.current);
  }, []);

  useEffect(() => {
    if (documentData?.blocks) {
      latestBlocksRef.current = documentData.blocks;
    }
  }, [documentData?.blocks]);

  useEffect(() => {
    if (documentData?.title && !isRenamingTitle) {
      setTitleDraft(documentData.title);
    }
  }, [documentData?.title, isRenamingTitle]);

  useEffect(() => {
    if (documentData?.title) {
      document.title = documentData.title;
    }
  }, [documentData?.title]);

  const pages = documentData?.pages || [];
  const liveBlocks = documentData?.blocks || [];
  const versions = documentData?.versions || [];

  const visibleBlocks =
    previewIndex === null
      ? liveBlocks
      : documentData?.versions?.[previewIndex]?.blocks || liveBlocks;

  const currentPageBlocks = useMemo(() => visibleBlocks, [visibleBlocks]);

  const livePageBlocks = useMemo(
    () => liveBlocks.filter((block) => block.page_id === activePageId),
    [activePageId, liveBlocks],
  );

  const pageMap = useMemo(
    () => Object.fromEntries(pages.map((page) => [page.id, page])),
    [pages],
  );

  const sectionStartIds = useMemo(() => {
    const starts = {};
    pages.forEach((page) => {
      const firstBlock = currentPageBlocks.find((block) => block.page_id === page.id);
      if (firstBlock) {
        starts[page.id] = firstBlock.id;
      }
    });
    return starts;
  }, [currentPageBlocks, pages]);

  useEffect(() => {
    if (!currentPageBlocks.length) {
      return;
    }

    const hasActiveInPage = currentPageBlocks.some((block) => block.id === activeBlockId);
    if (!hasActiveInPage) {
      setActiveBlockId(currentPageBlocks[0].id);
    }
  }, [activeBlockId, currentPageBlocks]);

  useEffect(() => {
    if (!activeBlockId) {
      return;
    }

    const activeBlock = liveBlocks.find((block) => block.id === activeBlockId);
    if (activeBlock?.page_id && activeBlock.page_id !== activePageId) {
      setActivePageId(activeBlock.page_id);
    }
  }, [activeBlockId, activePageId, liveBlocks]);

  useEffect(() => {
    if (previewIndex !== null || slashState.open || !activeBlockId || !documentData) {
      setAiState((previous) =>
        previous.blockId || previous.suggestion
          ? { blockId: "", suggestion: "" }
          : previous,
      );
      return undefined;
    }

    const block = liveBlocks.find((item) => item.id === activeBlockId);
    if (!block?.content?.trim() || block.content.startsWith("/")) {
      setAiState((previous) =>
        previous.blockId || previous.suggestion
          ? { blockId: "", suggestion: "" }
          : previous,
      );
      return undefined;
    }

    if (suppressedSuggestionMap[block.id] === block.content) {
      setAiState((previous) =>
        previous.blockId === block.id ? { blockId: "", suggestion: "" } : previous,
      );
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const pageTitle = pages.find((page) => page.id === block.page_id)?.title;
      const suggestion = buildAiSuggestion(block, pageTitle);
      if (!suggestion) {
        setAiState((previous) =>
          previous.blockId === block.id ? { blockId: "", suggestion: "" } : previous,
        );
        return;
      }
      setAiState((previous) =>
        previous.blockId === block.id && previous.suggestion === suggestion
          ? previous
          : {
              blockId: block.id,
              suggestion,
            },
      );
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    activeBlockId,
    documentData,
    liveBlocks,
    pages,
    previewIndex,
    slashState.open,
    suppressedSuggestionMap,
  ]);

  useLayoutEffect(() => {
    if (selectedBlockIds.length < 2 || !pageRef.current) {
      setSelectionGlow((previous) => (previous ? null : previous));
      return;
    }

    const nodes = currentPageBlocks
      .filter((block) => selectedBlockIds.includes(block.id))
      .map((block) => blockRefs.current[block.id])
      .filter(Boolean);

    if (nodes.length < 2) {
      setSelectionGlow(null);
      return;
    }

    const tops = nodes.map((node) => node.offsetTop);
    const bottoms = nodes.map((node) => node.offsetTop + node.offsetHeight);

    const nextGlow = {
      top: Math.min(...tops) - 6,
      height: Math.max(...bottoms) - Math.min(...tops) + 12,
    };

    setSelectionGlow((previous) =>
      previous &&
      previous.top === nextGlow.top &&
      previous.height === nextGlow.height
        ? previous
        : nextGlow,
    );
  }, [currentPageBlocks, selectedBlockIds]);

  useEffect(() => {
    if (previewIndex !== null) {
      setActivePanel("history");
    }
  }, [previewIndex]);

  useEffect(() => {
    window.clearInterval(demoIntervalRef.current);

    if (!demoMode || !pages.length || !liveBlocks.length) {
      setDemoParticipants((previous) => (previous.length ? [] : previous));
      setDemoTypingPreviews((previous) => (previous.length ? [] : previous));
      return undefined;
    }

    const activePageIndex = Math.max(
      pages.findIndex((page) => page.id === activePageId),
      0,
    );
    const activePageBlocks = liveBlocks.filter((block) => block.page_id === activePageId);
    const fallbackPageId = pages[activePageIndex]?.id || activePageId;
    const nextPage = pages[(activePageIndex + 1) % pages.length] || pages[activePageIndex];
    const nextPageId = nextPage?.id || fallbackPageId;
    const nextPageBlocks = liveBlocks.filter((block) => block.page_id === nextPageId);

    const preferredActiveBlocks = activePageBlocks.filter((block) => block.type !== "divider");
    const preferredBodyBlocks = preferredActiveBlocks.filter((block) => block.type !== "heading");
    const preferredNextBlocks = nextPageBlocks.filter((block) => block.type !== "divider");

    const firstBlockId = preferredBodyBlocks[0]?.id || preferredActiveBlocks[0]?.id || "";
    const secondBlockId = preferredActiveBlocks[1]?.id || preferredActiveBlocks[0]?.id || firstBlockId;
    const thirdBlockId = preferredBodyBlocks[1]?.id || preferredBodyBlocks[0]?.id || secondBlockId || firstBlockId;
    const nextBlockId = preferredNextBlocks[0]?.id || secondBlockId || firstBlockId;
    const firstBlockContent = preferredBodyBlocks[0]?.content || preferredActiveBlocks[0]?.content || "";
    const secondBlockContent = preferredActiveBlocks[1]?.content || preferredActiveBlocks[0]?.content || firstBlockContent;
    const thirdBlockContent = preferredBodyBlocks[1]?.content || preferredBodyBlocks[0]?.content || secondBlockContent;

    const frames = [
      {
        participants: [
          createDemoParticipant(DEMO_COLLABORATORS[0], {
            active_page: fallbackPageId,
            active_block_id: firstBlockId,
            is_typing: true,
            position_ratio: 0.12,
            x: 250,
            y: 220,
          }),
          createDemoParticipant(DEMO_COLLABORATORS[1], {
            active_page: fallbackPageId,
            active_block_id: secondBlockId,
            is_typing: false,
            position_ratio: 0.28,
            x: 850,
            y: 455,
          }),
        ],
        typingPreviews: firstBlockId
          ? [
              createDemoTypingPreview(DEMO_COLLABORATORS[0], {
                block_id: firstBlockId,
                page_id: fallbackPageId,
                content: `${firstBlockContent} together.`,
              }),
            ]
          : [],
      },
      {
        participants: [
          createDemoParticipant(DEMO_COLLABORATORS[0], {
            active_page: fallbackPageId,
            active_block_id: secondBlockId,
            is_typing: false,
            position_ratio: 0.28,
            x: 340,
            y: 320,
          }),
          createDemoParticipant(DEMO_COLLABORATORS[1], {
            active_page: fallbackPageId,
            active_block_id: thirdBlockId,
            is_typing: true,
            position_ratio: 0.5,
            x: 570,
            y: 500,
          }),
        ],
        typingPreviews: thirdBlockId
          ? [
              createDemoTypingPreview(DEMO_COLLABORATORS[1], {
                block_id: thirdBlockId,
                page_id: fallbackPageId,
                content: `${thirdBlockContent} Make the final beat feel more human.`,
              }),
            ]
          : [],
      },
      {
        participants: [
          createDemoParticipant(DEMO_COLLABORATORS[0], {
            active_page: nextPageId,
            active_block_id: nextBlockId,
            is_typing: false,
            position_ratio: 0.34,
            x: 230,
            y: 220,
          }),
          createDemoParticipant(DEMO_COLLABORATORS[1], {
            active_page: fallbackPageId,
            active_block_id: secondBlockId,
            is_typing: false,
            position_ratio: 0.34,
            x: 470,
            y: 340,
          }),
        ],
        typingPreviews: [],
      },
      {
        participants: [
          createDemoParticipant(DEMO_COLLABORATORS[0], {
            active_page: fallbackPageId,
            active_block_id: thirdBlockId,
            is_typing: true,
            position_ratio: 0.48,
            x: 280,
            y: 520,
          }),
          createDemoParticipant(DEMO_COLLABORATORS[1], {
            active_page: nextPageId,
            active_block_id: nextBlockId,
            is_typing: false,
            position_ratio: 0.52,
            x: 520,
            y: 280,
          }),
        ],
        typingPreviews: thirdBlockId
          ? [
              createDemoTypingPreview(DEMO_COLLABORATORS[0], {
                block_id: thirdBlockId,
                page_id: fallbackPageId,
                content: `${thirdBlockContent} Tighten the phrasing before the team reviews it.`,
              }),
            ]
          : [],
      },
    ];

    let frameIndex = 0;

    const applyFrame = (frame) => {
      setDemoParticipants(frame.participants);
      setDemoTypingPreviews(frame.typingPreviews);
    };

    applyFrame(frames[0]);
    demoIntervalRef.current = window.setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length;
      applyFrame(frames[frameIndex]);
    }, 2800);

    return () => {
      window.clearInterval(demoIntervalRef.current);
    };
  }, [activePageId, demoMode, liveBlocks, pages]);

  const currentPage = pages.find((page) => page.id === activePageId);
  const shareLink = buildPublishedUrl();
  const baseParticipants = participants.length ? participants : [session];
  const collaboratorList = demoMode
    ? [session, ...demoParticipants]
    : baseParticipants;
  const effectiveTypingPreviews = demoMode
    ? demoTypingPreviews
    : typingPreviews;
  const showLeftRail = activePanel === "history" || activePanel === "overview";
  const showCommentsRail = activePanel === "comments";
  const activeLiveBlock =
    liveBlocks.find((block) => block.id === activeBlockId) ||
    livePageBlocks[0] ||
    currentPageBlocks[0] ||
    null;
  const currentDocumentSection =
    (activeLiveBlock && pageMap[activeLiveBlock.page_id]) ||
    currentPage ||
    pages[0] ||
    null;
  const toolbarState = {
    activeStyles: activeLiveBlock?.styles || [],
    activeType: activeLiveBlock?.type || "paragraph",
    fontFamily: activeLiveBlock?.font_family || "Inter",
    fontSize: activeLiveBlock?.font_size || 14,
    zoomLevel,
  };

  const filteredCommands = useMemo(() => {
    const normalizedQuery = slashState.query.trim().toLowerCase();
    return commandOptions.filter((command) => {
      if (!normalizedQuery) {
        return true;
      }
      return `${command.label} ${command.description}`.toLowerCase().includes(normalizedQuery);
    });
  }, [slashState.query]);

  const remoteGhostMap = useMemo(() => {
    const map = {};
    effectiveTypingPreviews
      .filter((preview) => preview.session_id !== session.session_id)
      .forEach((preview) => {
        map[preview.block_id] = preview;
      });
    return map;
  }, [effectiveTypingPreviews, session.session_id]);

  const collaboratorsByBlock = useMemo(() => {
    const map = {};

    collaboratorList
      .filter((participant) => participant.session_id !== session.session_id && participant.active_block_id)
      .forEach((participant) => {
        if (!map[participant.active_block_id]) {
          map[participant.active_block_id] = [];
        }
        map[participant.active_block_id].push(participant);
      });

    return map;
  }, [collaboratorList, session.session_id]);

  const currentPageParticipants = collaboratorList.filter(
    (participant) => participant.session_id !== session.session_id,
  );

  const sendMessage = (payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  const getScrollRatio = () => {
    const node = scrollRef.current;
    if (!node) {
      return 0;
    }

    const totalScrollable = Math.max(node.scrollHeight - node.clientHeight, 1);
    return Math.min(1, Math.max(0, node.scrollTop / totalScrollable));
  };

  const syncCursor = (overrides = {}) => {
    sendMessage({
      type: "cursor_move",
      x: overrides.x ?? 140,
      y: overrides.y ?? 180,
      active_page: overrides.active_page ?? activePageId,
      position_ratio: overrides.position_ratio ?? getScrollRatio(),
      active_block_id: overrides.active_block_id ?? activeBlockId,
      is_typing: overrides.is_typing ?? false,
    });
  };

  const updateLocalBlocks = (nextBlocks, options = {}) => {
    const { recordHistory = true } = options;
    const nextSnapshot = cloneBlocks(nextBlocks);
    const previousSnapshot = cloneBlocks(latestBlocksRef.current || []);

    if (recordHistory) {
      const previousFingerprint = buildBlocksFingerprint(previousSnapshot);
      const nextFingerprint = buildBlocksFingerprint(nextSnapshot);
      if (previousFingerprint !== nextFingerprint) {
        setUndoStack((previous) => [...previous.slice(-39), previousSnapshot]);
        setRedoStack([]);
      }
    }

    latestBlocksRef.current = nextSnapshot;
    setDocumentData((previous) =>
      previous
        ? {
            ...previous,
            blocks: nextSnapshot,
            updated_at: new Date().toISOString(),
          }
        : previous,
    );
  };

  const commitBlocks = (nextBlocks, reason) => {
    if (previewIndex !== null) {
      return;
    }

    sendMessage({
      type: "blocks_replace",
      blocks: nextBlocks,
      reason,
      author: session.name,
    });
  };

  const handlePageChange = (pageId) => {
    setSelectedBlockIds([]);
    setPreviewIndex(null);

    const targetBlockId = sectionStartIds[pageId];
    if (targetBlockId) {
      focusBlock(targetBlockId, pageId);
      syncCursor({ active_page: pageId, active_block_id: targetBlockId, position_ratio: 0.08 });
      return;
    }

    setActivePageId(pageId);
    syncCursor({ active_page: pageId, active_block_id: "", position_ratio: 0.08 });
  };

  const togglePanel = (panel) => {
    if (panel !== "history" && previewIndex !== null) {
      setPreviewIndex(null);
    }

    setActivePanel((previous) => (previous === panel ? null : panel));
  };

  const handleToggleDemo = () => {
    setDemoMode((previous) => {
      const nextValue = !previous;
      toast.message(
        nextValue
          ? "Showing a 2-person collaboration demo."
          : "Collaboration demo turned off.",
      );
      return nextValue;
    });
  };

  const handleRenameStart = () => {
    if (!documentData?.title) {
      return;
    }

    setTitleDraft(documentData.title);
    setIsRenamingTitle(true);
  };

  const handleRenameChange = (value) => {
    setTitleDraft(value);
  };

  const handleRenameCancel = () => {
    setTitleDraft(documentData?.title || "");
    setIsRenamingTitle(false);
  };

  const handleRenameSave = async (nextValue = titleDraft) => {
    if (!documentData || titleSaveInFlightRef.current) {
      return;
    }

    const trimmedTitle = nextValue.trim();
    if (!trimmedTitle) {
      setTitleDraft(documentData.title);
      setIsRenamingTitle(false);
      toast.message("File name cannot be empty.");
      return;
    }

    if (trimmedTitle === documentData.title) {
      setTitleDraft(documentData.title);
      setIsRenamingTitle(false);
      return;
    }

    titleSaveInFlightRef.current = true;
    setIsSavingTitle(true);
    try {
      const response = await axios.post(`${API}/document/title`, {
        title: trimmedTitle,
      });
      setDocumentData(response.data);
      latestBlocksRef.current = response.data.blocks || [];
      setTitleDraft(response.data.title);
      setIsRenamingTitle(false);
      toast.success("File name updated.");
    } catch (error) {
      console.error(error);
      setTitleDraft(documentData.title);
      toast.error("Could not update the file name.");
    } finally {
      titleSaveInFlightRef.current = false;
      setIsSavingTitle(false);
    }
  };

  const handleOpenComments = (blockId) => {
    setActiveBlockId(blockId);
    setActivePanel("comments");
  };

  const getTargetBlockIds = () => {
    if (selectedBlockIds.length) {
      return selectedBlockIds;
    }

    if (activeBlockId) {
      return [activeBlockId];
    }

    return liveBlocks[0] ? [liveBlocks[0].id] : [];
  };

  const triggerAiSuggestion = () => {
    const targetBlock = activeLiveBlock;
    if (!targetBlock?.content?.trim()) {
      toast.message("Write a little more before asking for an AI suggestion.");
      return;
    }

    const pageTitle = pages.find((page) => page.id === targetBlock.page_id)?.title;
    const suggestion = buildAiSuggestion(targetBlock, pageTitle);
    if (!suggestion) {
      toast.message("This block type does not have a suggestion right now.");
      return;
    }

    setSuppressedSuggestionMap((previous) => {
      if (!previous[targetBlock.id]) {
        return previous;
      }
      const next = { ...previous };
      delete next[targetBlock.id];
      return next;
    });
    setAiState({ blockId: targetBlock.id, suggestion });
    toast.success("AI suggestion ready. Press Tab to accept it.");
  };

  const dismissAiSuggestion = (blockId, content) => {
    setAiState((previous) =>
      previous.blockId === blockId ? { blockId: "", suggestion: "" } : previous,
    );
    setSuppressedSuggestionMap((previous) => ({
      ...previous,
      [blockId]: content,
    }));
  };

  const toggleTextStyle = (style) => {
    const targetIds = getTargetBlockIds();
    if (!targetIds.length) {
      return;
    }

    const nextBlocks = latestBlocksRef.current.map((block) => {
      if (!targetIds.includes(block.id)) {
        return block;
      }

      const currentStyles = new Set(Array.isArray(block.styles) ? block.styles : []);
      if (currentStyles.has(style)) {
        currentStyles.delete(style);
      } else {
        currentStyles.add(style);
      }

      return {
        ...block,
        styles: Array.from(currentStyles),
        updated_at: new Date().toISOString(),
      };
    });

    updateLocalBlocks(nextBlocks);
    commitBlocks(nextBlocks, `Updated ${style} formatting`);
  };

  const applyBlockFont = (fontFamily) => {
    const targetIds = getTargetBlockIds();
    if (!targetIds.length) {
      return;
    }

    const nextBlocks = latestBlocksRef.current.map((block) =>
      targetIds.includes(block.id)
        ? {
            ...block,
            font_family: fontFamily,
            updated_at: new Date().toISOString(),
          }
        : block,
    );

    updateLocalBlocks(nextBlocks);
    commitBlocks(nextBlocks, `Changed font to ${fontFamily}`);
  };

  const applyBlockSize = (fontSize) => {
    const targetIds = getTargetBlockIds();
    if (!targetIds.length) {
      return;
    }

    const nextSize = Number(fontSize) || 14;
    const nextBlocks = latestBlocksRef.current.map((block) =>
      targetIds.includes(block.id)
        ? {
            ...block,
            font_size: nextSize,
            updated_at: new Date().toISOString(),
          }
        : block,
    );

    updateLocalBlocks(nextBlocks);
    commitBlocks(nextBlocks, `Changed font size to ${nextSize}`);
  };

  const applyBlockType = (type) => {
    const targetIds = getTargetBlockIds();
    if (!targetIds.length) {
      return;
    }

    const nextBlocks = latestBlocksRef.current.map((block) =>
      targetIds.includes(block.id)
        ? {
            ...block,
            type,
            placeholder: blockPlaceholders[type] || block.placeholder,
            updated_at: new Date().toISOString(),
          }
        : block,
    );

    updateLocalBlocks(nextBlocks);
    commitBlocks(nextBlocks, `Changed block style to ${type}`);
  };

  const insertBlockAfterActive = (type = "paragraph") => {
    const currentBlocks = latestBlocksRef.current;
    const pageBlocks = currentBlocks.filter((block) => block.page_id === activePageId);
    const nextBlock = buildNewBlock(activePageId, type);
    const activeIndex = pageBlocks.findIndex((block) => block.id === activeBlockId);
    const insertIndex = activeIndex >= 0 ? activeIndex + 1 : pageBlocks.length;
    const nextPageBlocks = [...pageBlocks];
    nextPageBlocks.splice(insertIndex, 0, nextBlock);

    const nextBlocks = replacePageBlocks(currentBlocks, pages, activePageId, nextPageBlocks);
    updateLocalBlocks(nextBlocks);
    commitBlocks(nextBlocks, `Inserted ${type} block`);
    focusBlock(nextBlock.id, activePageId);
  };

  const duplicateActiveBlock = () => {
    const currentBlocks = latestBlocksRef.current;
    const sourceBlock = currentBlocks.find((block) => block.id === activeBlockId);
    if (!sourceBlock) {
      return;
    }

    const pageBlocks = currentBlocks.filter((block) => block.page_id === activePageId);
    const sourceIndex = pageBlocks.findIndex((block) => block.id === activeBlockId);
    const duplicateBlock = {
      ...sourceBlock,
      id: globalThis.crypto?.randomUUID?.() || `block-${Date.now()}`,
      updated_at: new Date().toISOString(),
    };
    const nextPageBlocks = [...pageBlocks];
    nextPageBlocks.splice(sourceIndex + 1, 0, duplicateBlock);
    const nextBlocks = replacePageBlocks(currentBlocks, pages, activePageId, nextPageBlocks);

    updateLocalBlocks(nextBlocks);
    commitBlocks(nextBlocks, "Duplicated block");
    focusBlock(duplicateBlock.id, activePageId);
  };

  const handleUndo = () => {
    setUndoStack((previous) => {
      if (!previous.length) {
        toast.message("Nothing to undo.");
        return previous;
      }

      const snapshot = previous[previous.length - 1];
      const remainingHistory = previous.slice(0, -1);
      const currentSnapshot = cloneBlocks(latestBlocksRef.current || []);

      setRedoStack((redoPrevious) => [...redoPrevious.slice(-39), currentSnapshot]);
      updateLocalBlocks(snapshot, { recordHistory: false });
      commitBlocks(snapshot, "Undo edit");

      return remainingHistory;
    });
  };

  const handleRedo = () => {
    setRedoStack((previous) => {
      if (!previous.length) {
        toast.message("Nothing to redo.");
        return previous;
      }

      const snapshot = previous[previous.length - 1];
      const remainingHistory = previous.slice(0, -1);
      const currentSnapshot = cloneBlocks(latestBlocksRef.current || []);

      setUndoStack((undoPrevious) => [...undoPrevious.slice(-39), currentSnapshot]);
      updateLocalBlocks(snapshot, { recordHistory: false });
      commitBlocks(snapshot, "Redo edit");

      return remainingHistory;
    });
  };

  const handleCopyBlock = async () => {
    const sourceBlock = latestBlocksRef.current.find((block) => block.id === activeBlockId);
    if (!sourceBlock) {
      toast.message("Select a block first.");
      return;
    }

    const snapshot = {
      ...sourceBlock,
      styles: Array.isArray(sourceBlock.styles) ? [...sourceBlock.styles] : [],
    };
    setCopiedBlock(snapshot);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(sourceBlock.content || "");
      }
    } catch {
      // Clipboard write is optional.
    }

    toast.success("Block copied.");
  };

  const handlePasteBlock = () => {
    if (!copiedBlock) {
      toast.message("Copy a block first.");
      return;
    }

    const targetPageId = activeLiveBlock?.page_id || activePageId || pages[0]?.id;
    if (!targetPageId) {
      return;
    }

    const currentBlocks = latestBlocksRef.current;
    const pageBlocks = currentBlocks.filter((block) => block.page_id === targetPageId);
    const insertAfterIndex = pageBlocks.findIndex((block) => block.id === activeBlockId);
    const nextBlock = {
      ...copiedBlock,
      id: globalThis.crypto?.randomUUID?.() || `block-${Date.now()}`,
      page_id: targetPageId,
      section: pageMap[targetPageId]?.title || copiedBlock.section || "New Scene",
      styles: Array.isArray(copiedBlock.styles) ? [...copiedBlock.styles] : [],
      updated_at: new Date().toISOString(),
    };

    const nextPageBlocks = [...pageBlocks];
    const insertIndex = insertAfterIndex >= 0 ? insertAfterIndex + 1 : nextPageBlocks.length;
    nextPageBlocks.splice(insertIndex, 0, nextBlock);

    const nextBlocks = replacePageBlocks(currentBlocks, pages, targetPageId, nextPageBlocks);
    updateLocalBlocks(nextBlocks);
    commitBlocks(nextBlocks, "Pasted block");
    focusBlock(nextBlock.id, targetPageId);
  };

  const handleDeleteBlock = async (targetBlockId = activeBlockId) => {
    if (!targetBlockId || previewIndex !== null) {
      return;
    }

    try {
      clearPendingCommits();
      const response = await axios.delete(`${API}/document/block/${targetBlockId}`);
      const nextDocument = response.data;
      setDocumentData(nextDocument);
      latestBlocksRef.current = nextDocument.blocks || [];

      const fallbackBlock = nextDocument.blocks?.find((block) => block.id !== targetBlockId) || nextDocument.blocks?.[0];
      if (fallbackBlock) {
        setActiveBlockId(fallbackBlock.id);
        setActivePageId(fallbackBlock.page_id);
        setSelectedBlockIds([fallbackBlock.id]);
      } else {
        setActiveBlockId("");
        setSelectedBlockIds([]);
      }

      setAiState({ blockId: "", suggestion: "" });
      setUndoStack([]);
      setRedoStack([]);
      toast.success("Block deleted.");
    } catch (error) {
      console.error(error);
      toast.error("Could not delete the block.");
    }
  };

  const handleNewDocument = async () => {
    if (previewIndex !== null) {
      setPreviewIndex(null);
    }

    try {
      clearPendingCommits();
      const response = await axios.post(`${API}/document`);
      const nextDocument = response.data;
      const firstPageId = nextDocument.pages?.[0]?.id || "page-1";
      const firstBlockId = nextDocument.blocks?.[0]?.id || "";

      setDocumentData(nextDocument);
      latestBlocksRef.current = nextDocument.blocks || [];
      setTitleDraft(nextDocument.title);
      setIsRenamingTitle(false);
      setActivePageId(firstPageId);
      setActiveBlockId(firstBlockId);
      setSelectedBlockIds(firstBlockId ? [firstBlockId] : []);
      setActivePanel(null);
      setAiState({ blockId: "", suggestion: "" });
      setSuppressedSuggestionMap({});
      setUndoStack([]);
      setRedoStack([]);
      setCopiedBlock(null);
      syncCursor({
        active_page: firstPageId,
        active_block_id: firstBlockId,
        position_ratio: 0.08,
      });

      toast.success("New document created.");
    } catch (error) {
      console.error(error);
      toast.error("Could not start a new document.");
    }
  };

  const handleSaveDocument = () => {
    const currentBlocks = latestBlocksRef.current;
    commitBlocks(currentBlocks, "Manual save");
    toast.success("All changes saved.");
  };

  const handlePrintDocument = () => {
    window.print();
  };

  const handleToolbarAction = (action, value) => {
    switch (action) {
      case "toggle-style":
        toggleTextStyle(value);
        break;
      case "set-font":
        applyBlockFont(value);
        break;
      case "set-size":
        applyBlockSize(value);
        break;
      case "set-zoom":
        setZoomLevel(value);
        break;
      case "set-type":
        applyBlockType(value);
        break;
      case "undo":
        handleUndo();
        break;
      case "redo":
        handleRedo();
        break;
      default:
        break;
    }
  };

  const handleMenuAction = (action) => {
    switch (action) {
      case "new-document":
        handleNewDocument();
        break;
      case "save-document":
        handleSaveDocument();
        break;
      case "print-document":
        handlePrintDocument();
        break;
      case "insert-heading":
        insertBlockAfterActive("heading");
        break;
      case "insert-paragraph":
        insertBlockAfterActive("paragraph");
        break;
      case "insert-quote":
        insertBlockAfterActive("quote");
        break;
      case "insert-list":
        insertBlockAfterActive("list");
        break;
      case "duplicate-block":
        duplicateActiveBlock();
        break;
      case "delete-block":
        handleDeleteBlock();
        break;
      case "share-document":
        handlePublish();
        break;
      case "undo":
        handleUndo();
        break;
      case "redo":
        handleRedo();
        break;
      case "copy-block":
        handleCopyBlock();
        break;
      case "paste-block":
        handlePasteBlock();
        break;
      case "cut-block":
        handleCopyBlock();
        handleDeleteBlock();
        break;
      case "format-bold":
        toggleTextStyle("bold");
        break;
      case "format-italic":
        toggleTextStyle("italic");
        break;
      case "format-underline":
        toggleTextStyle("underline");
        break;
      case "trigger-ai":
        triggerAiSuggestion();
        break;
      case "open-outline":
        setActivePanel("overview");
        break;
      case "open-comments":
        setActivePanel("comments");
        break;
      case "open-history":
        setActivePanel("history");
        break;
      case "collapse-panels":
        setActivePanel(null);
        break;
      case "toggle-demo":
        handleToggleDemo();
        break;
      case "set-type-paragraph":
        applyBlockType("paragraph");
        break;
      case "set-type-heading":
        applyBlockType("heading");
        break;
      case "set-type-quote":
        applyBlockType("quote");
        break;
      case "set-type-list":
        applyBlockType("list");
        break;
      default:
        break;
    }
  };

  const focusBlock = (blockId, pageId = activePageId) => {
    if (pageId !== activePageId) {
      setActivePageId(pageId);
    }
    setActiveBlockId(blockId);
    setFocusFlashId(blockId);
    window.setTimeout(() => setFocusFlashId(""), 900);

    window.setTimeout(() => {
      blockRefs.current[blockId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      blockRefs.current[blockId]?.querySelector("textarea")?.focus({ preventScroll: true });
    }, 60);
  };

  const handleBlockChange = (blockId, nextValue) => {
    if (previewIndex !== null) {
      return;
    }

    setAiState((previous) =>
      previous.blockId === blockId ? { blockId: "", suggestion: "" } : previous,
    );
    setSuppressedSuggestionMap((previous) => {
      if (!previous[blockId]) {
        return previous;
      }
      const next = { ...previous };
      delete next[blockId];
      return next;
    });

    const nextBlocks = latestBlocksRef.current.map((block) =>
      block.id === blockId
        ? {
            ...block,
            content: nextValue,
            updated_at: new Date().toISOString(),
          }
        : block,
    );

    updateLocalBlocks(nextBlocks);
    setActiveBlockId(blockId);
    selectionAnchorRef.current = blockId;

    const block = nextBlocks.find((item) => item.id === blockId);
    sendMessage({
      type: "typing_preview",
      block_id: blockId,
      content: nextValue,
      page_id: block?.page_id || activePageId,
    });

    if (nextValue.startsWith("/")) {
      setSlashState({
        open: true,
        blockId,
        query: nextValue.slice(1),
        selectedIndex: 0,
      });
    } else if (slashState.blockId === blockId) {
      setSlashState({ open: false, blockId: "", query: "", selectedIndex: 0 });
    }

    window.clearTimeout(commitTimersRef.current[blockId]);
    commitTimersRef.current[blockId] = window.setTimeout(() => {
      commitBlocks(nextBlocks, `Edited ${block?.section || "block"}`);
    }, 520);
  };

  const applySlashCommand = (command) => {
    if (!slashState.blockId) {
      return;
    }

    const currentBlocks = latestBlocksRef.current;
    const targetBlock = currentBlocks.find((block) => block.id === slashState.blockId);
    if (!targetBlock) {
      return;
    }

    if (command.id === "spark") {
      setSuppressedSuggestionMap((previous) => {
        if (!previous[targetBlock.id]) {
          return previous;
        }
        const next = { ...previous };
        delete next[targetBlock.id];
        return next;
      });
      setAiState({
        blockId: targetBlock.id,
        suggestion: buildAiSuggestion(targetBlock, currentPage?.title),
      });
      setSlashState({ open: false, blockId: "", query: "", selectedIndex: 0 });
      toast.success("AI spark is ready. Press Tab on the block to accept it.");
      return;
    }

    const nextBlocks = currentBlocks.map((block) =>
      block.id === slashState.blockId
        ? {
            ...block,
            type: command.type,
            content: command.type === "divider" ? "" : "",
            placeholder: command.placeholder,
            updated_at: new Date().toISOString(),
          }
        : block,
    );

    updateLocalBlocks(nextBlocks);
    setSlashState({ open: false, blockId: "", query: "", selectedIndex: 0 });
    commitBlocks(nextBlocks, `Switched block to ${command.label}`);
    toast.success(`${command.label} block created.`);
  };

  const handleBlockKeyDown = (event, block) => {
    if (slashState.open && slashState.blockId === block.id) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSlashState((previous) => ({
          ...previous,
          selectedIndex: Math.min(
            previous.selectedIndex + 1,
            Math.max(filteredCommands.length - 1, 0),
          ),
        }));
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSlashState((previous) => ({
          ...previous,
          selectedIndex: Math.max(previous.selectedIndex - 1, 0),
        }));
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (filteredCommands.length) {
          applySlashCommand(filteredCommands[slashState.selectedIndex] || filteredCommands[0]);
        }
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setSlashState({ open: false, blockId: "", query: "", selectedIndex: 0 });
      }
    }

    if (event.key === "Tab" && aiState.blockId === block.id && aiState.suggestion) {
      event.preventDefault();
      const nextBlocks = latestBlocksRef.current.map((item) =>
        item.id === block.id
          ? {
              ...item,
              content: `${item.content}${aiState.suggestion}`,
              updated_at: new Date().toISOString(),
            }
          : item,
      );

      updateLocalBlocks(nextBlocks);
      setAiState({ blockId: "", suggestion: "" });
      setSuppressedSuggestionMap((previous) => ({
        ...previous,
        [block.id]: `${block.content}${aiState.suggestion}`,
      }));
      commitBlocks(nextBlocks, "Accepted AI suggestion");
    }
  };

  const handleSelectBlock = (blockId, event) => {
    setActiveBlockId(blockId);

    if (!event.shiftKey) {
      setSelectedBlockIds([blockId]);
      selectionAnchorRef.current = blockId;
      return;
    }

    const pageBlockIds = currentPageBlocks.map((block) => block.id);
    const anchor = selectionAnchorRef.current || blockId;
    const anchorIndex = pageBlockIds.indexOf(anchor);
    const targetIndex = pageBlockIds.indexOf(blockId);

    if (anchorIndex === -1 || targetIndex === -1) {
      setSelectedBlockIds([blockId]);
      selectionAnchorRef.current = blockId;
      return;
    }

    const start = Math.min(anchorIndex, targetIndex);
    const end = Math.max(anchorIndex, targetIndex);
    setSelectedBlockIds(pageBlockIds.slice(start, end + 1));
  };

  const handleAddBlock = () => {
    const currentBlocks = latestBlocksRef.current;
    const pageBlocks = currentBlocks.filter((block) => block.page_id === activePageId);
    const nextBlock = buildNewBlock(activePageId, "paragraph");
    const nextPageBlocks = [...pageBlocks, nextBlock];
    const nextBlocks = replacePageBlocks(currentBlocks, pages, activePageId, nextPageBlocks);

    updateLocalBlocks(nextBlocks);
    commitBlocks(nextBlocks, "Added new block");
    focusBlock(nextBlock.id, activePageId);
  };

  const handleDragStart = (draggingId) => {
    setDragState({ draggingId, targetId: "", position: "after" });
  };

  const handleDragOver = (event, targetId) => {
    if (previewIndex !== null || !dragState.draggingId) {
      return;
    }

    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDragState((previous) => ({ ...previous, targetId, position }));
  };

  const handleDrop = (targetId) => {
    if (!dragState.draggingId || dragState.draggingId === targetId) {
      setDragState({ draggingId: "", targetId: "", position: "after" });
      return;
    }

    const currentBlocks = latestBlocksRef.current;
    const pageBlocks = currentBlocks.filter((block) => block.page_id === activePageId);
    const draggingIndex = pageBlocks.findIndex((block) => block.id === dragState.draggingId);
    const targetIndex = pageBlocks.findIndex((block) => block.id === targetId);

    if (draggingIndex === -1 || targetIndex === -1) {
      setDragState({ draggingId: "", targetId: "", position: "after" });
      return;
    }

    const nextPageBlocks = [...pageBlocks];
    const [moved] = nextPageBlocks.splice(draggingIndex, 1);
    const insertIndex = dragState.position === "before" ? targetIndex : targetIndex + 1;
    nextPageBlocks.splice(insertIndex, 0, moved);

    const nextBlocks = replacePageBlocks(currentBlocks, pages, activePageId, nextPageBlocks);
    updateLocalBlocks(nextBlocks);
    commitBlocks(nextBlocks, "Reordered blocks");
    setDragState({ draggingId: "", targetId: "", position: "after" });
  };

  const handleAnnotationSave = async (blockId, text) => {
    try {
      const response = await axios.post(`${API}/document/annotations`, {
        block_id: blockId,
        text,
      });
      setDocumentData(response.data);
      latestBlocksRef.current = response.data.blocks || [];
      toast.success("Margin note saved.");
    } catch (error) {
      console.error(error);
      toast.error("Could not save the margin note.");
    }
  };

  const handleAddComment = async (blockId, text) => {
    try {
      const response = await axios.post(`${API}/document/comments`, {
        block_id: blockId,
        author_name: session.name,
        author_color: session.color,
        avatar_url: session.avatar_url,
        text,
      });
      setDocumentData(response.data);
      latestBlocksRef.current = response.data.blocks || [];
      toast.success("Comment added.");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Could not add the comment.");
      return false;
    }
  };

  const handlePublish = async (event, pageId) => {
    if (pageId) {
      handlePageChange(pageId);
      return;
    }

    try {
      setIsPublishing(true);
      const response = await axios.post(`${API}/document/publish`, {
        author_name: session.name,
      });
      setDocumentData(response.data.document);
      latestBlocksRef.current = response.data.document.blocks || [];

      let copiedToClipboard = false;

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareLink);
          copiedToClipboard = true;
        }
      } catch {
        toast.message("Published successfully. Copy the published link from the address bar if needed.");
      }

      setShareCopied(copiedToClipboard);
      if (copiedToClipboard) {
        window.setTimeout(() => setShareCopied(false), 1800);
      }
      if (response.data.first_publish) {
        setConfettiActive(true);
      }
      toast.success(
        copiedToClipboard
          ? "Published cut is ready and the share link is copied."
          : "Published cut is ready.",
      );
    } catch (error) {
      console.error(error);
      toast.error("Could not publish the shared cut.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePreviewChange = (index) => {
    if (index >= versions.length - 1) {
      setPreviewIndex(null);
      return;
    }

    setPreviewIndex(index);
    setActivePanel("history");
    const versionBlock = versions[index]?.blocks?.find((block) => block.page_id === activePageId);
    if (!versionBlock && versions[index]?.blocks?.[0]) {
      setActivePageId(versions[index].blocks[0].page_id);
    }
  };

  const handleRestoreVersion = async (versionId) => {
    try {
      const response = await axios.post(`${API}/document/restore/${versionId}`);
      setDocumentData(response.data);
      latestBlocksRef.current = response.data.blocks || [];
      setPreviewIndex(null);
      setActivePanel(null);
      toast.success("Version restored back into the live document.");
    } catch (error) {
      console.error(error);
      toast.error("Could not restore that version.");
    }
  };

  const handleMouseMove = (event) => {
    const now = Date.now();
    if (now - lastPointerRef.current < 70 || !pageRef.current) {
      return;
    }

    lastPointerRef.current = now;
    const rect = pageRef.current.getBoundingClientRect();
    syncCursor({
      x: Math.max(16, event.clientX - rect.left),
      y: Math.max(16, event.clientY - rect.top),
      is_typing: false,
    });
  };

  const handleScroll = () => {
    syncCursor({ position_ratio: getScrollRatio() });
  };

  if (!documentData) {
    return (
      <div className="editor-shell flex min-h-screen items-center justify-center">
        <div className="glass-panel flex items-center gap-3 rounded-lg px-6 py-3 text-slate-700" data-testid="editor-loading-state">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Loading collaborative canvas...
        </div>
      </div>
    );
  }

  return (
    <div className="editor-shell flex min-h-screen flex-col">
      <ConfettiBurst active={confettiActive} onComplete={() => setConfettiActive(false)} />

      <EditorHeader
        activePageId={activePageId}
        activePanel={activePanel}
        connectionState={connectionState}
        demoActive={demoMode}
        documentTitle={documentData.title}
        isRenamingTitle={isRenamingTitle}
        isSavingTitle={isSavingTitle}
        isPublished={Boolean(documentData.published_snapshot)}
        onMenuAction={handleMenuAction}
        onPublish={handlePublish}
        onRenameCancel={handleRenameCancel}
        onRenameChange={handleRenameChange}
        onRenameSave={handleRenameSave}
        onRenameStart={handleRenameStart}
        onSelectPage={handlePageChange}
        onToggleDemo={handleToggleDemo}
        onTogglePanel={togglePanel}
        onToolbarAction={handleToolbarAction}
        pages={pages}
        participants={collaboratorList}
        shareCopied={shareCopied}
        titleDraft={titleDraft}
        toolbarState={toolbarState}
      />

      <div className="relative z-10 flex min-h-0 flex-1" data-testid="editor-main-workspace">
        {showLeftRail ? (
          <aside
            className="hidden h-full w-[300px] shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col"
            data-testid={`${activePanel}-panel-drawer`}
          >
            {activePanel === "history" ? (
              <VersionTimeline
                onClose={() => setActivePanel(null)}
                onPreviewChange={handlePreviewChange}
                onRestore={handleRestoreVersion}
                onReturnLive={() => setPreviewIndex(null)}
                previewIndex={previewIndex}
                versions={versions}
              />
            ) : (
              <PresenceMinimap
                blocks={liveBlocks}
                className="h-full rounded-none border-0 shadow-none"
                currentPageId={activePageId}
                onClose={() => setActivePanel(null)}
                onFocusBlock={(blockId, pageId) => {
                  focusBlock(blockId, pageId);
                  setActivePanel(null);
                }}
                onSelectPage={(pageId) => {
                  handlePageChange(pageId);
                  setActivePanel(null);
                }}
                pages={pages}
                participants={collaboratorList}
              />
            )}
          </aside>
        ) : null}

        <main className="flex min-w-0 flex-1">
          <section
            className="h-full flex-1 overflow-y-auto bg-[#F1F3F4] px-4 py-6 sm:px-6 lg:px-10"
            data-testid="editor-canvas-scroll-area"
            onMouseMove={handleMouseMove}
            onScroll={handleScroll}
            ref={scrollRef}
          >
            <div className={`relative mx-auto w-full ${showCommentsRail ? "max-w-[1120px]" : "max-w-[980px]"} pb-16`}>
              <AnimatePresence mode="wait">
                <motion.div
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="paper-page relative mx-auto min-h-[1056px] w-full max-w-[816px] rounded-[2px] px-8 py-10 sm:px-12 sm:py-12"
                  data-testid="editor-paper-page-continuous"
                  exit={{ opacity: 0, y: 8, scale: 0.995 }}
                  initial={{ opacity: 0, y: 8, scale: 0.995 }}
                  key={`continuous-${previewIndex ?? "live"}`}
                  ref={pageRef}
                  style={{ zoom: `${zoomLevel}%` }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="mb-7 flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-[34rem]">
                      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400" data-testid="page-kicker-label">
                        Shared draft
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-500" data-testid="page-title">
                        {documentData.subtitle}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-500" data-testid="selection-count-indicator">
                        {selectedBlockIds.length || 1} selected
                      </span>
                      {currentDocumentSection ? (
                        <span className="rounded-md bg-white px-2.5 py-1 text-xs text-slate-500 ring-1 ring-slate-200" data-testid="active-section-indicator">
                          {currentDocumentSection.title}
                        </span>
                      ) : null}
                      {previewIndex !== null ? (
                        <span className="rounded-md bg-[#E8F0FE] px-2.5 py-1 text-xs text-[#174EA6]" data-testid="timeline-preview-badge">
                          Viewing past version
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {selectionGlow ? (
                    <motion.div
                      animate={{ opacity: 1 }}
                      className="selection-bridge"
                      data-testid="multi-block-selection-glow"
                      initial={{ opacity: 0 }}
                      style={{ top: selectionGlow.top, height: selectionGlow.height }}
                    />
                  ) : null}

                  <div className="relative z-10">
                    {currentPageBlocks.map((block, index) => {
                      const blockSection = pageMap[block.page_id];
                      const isSectionStart = sectionStartIds[block.page_id] === block.id;

                      return (
                        <Fragment key={block.id}>
                          {isSectionStart && blockSection ? (
                            <div
                              className={`${index === 0 ? "mb-5" : "mb-6 mt-12"}`}
                              data-testid={`section-divider-${blockSection.id}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-px flex-1 bg-slate-200" />
                                <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400">
                                  {blockSection.title}
                                </span>
                                <div className="h-px flex-1 bg-slate-200" />
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-500">
                                {blockSection.subtitle}
                              </p>
                            </div>
                          ) : null}

                          <EditorBlock
                            aiSuggestion={aiState.blockId === block.id ? aiState.suggestion : ""}
                            block={block}
                            collaboratorsEditing={collaboratorsByBlock[block.id] || []}
                            dragPosition={dragState.position}
                            fontFamily={block.font_family}
                            fontSize={block.font_size}
                            isActive={activeBlockId === block.id}
                            isDragTarget={dragState.targetId === block.id}
                            isFocusFlashing={focusFlashId === block.id}
                            isPreviewing={previewIndex !== null}
                            isSelected={selectedBlockIds.includes(block.id)}
                            onChange={handleBlockChange}
                            onDelete={handleDeleteBlock}
                            onDismissSuggestion={dismissAiSuggestion}
                            onDragOver={handleDragOver}
                            onDragStart={handleDragStart}
                            onDrop={handleDrop}
                            onFocus={setActiveBlockId}
                            onKeyDown={handleBlockKeyDown}
                            onOpenComments={handleOpenComments}
                            onSelect={handleSelectBlock}
                            registerRef={(blockId, node) => {
                              if (node) {
                                blockRefs.current[blockId] = node;
                              } else {
                                delete blockRefs.current[blockId];
                              }
                            }}
                            remoteGhost={remoteGhostMap[block.id]}
                            textStyles={block.styles || []}
                          />
                        </Fragment>
                      );
                    })}
                  </div>

                  <div className="mt-8 flex justify-center">
                    <Button
                      className="rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      data-testid="add-block-button"
                      onClick={handleAddBlock}
                      type="button"
                      variant="secondary"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add block
                    </Button>
                  </div>

                  {currentPageParticipants.map((participant) => (
                    <CollaboratorCursor key={participant.session_id} participant={participant} />
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </section>

          {showCommentsRail ? (
            <CommentRail
              activeBlockId={activeBlockId}
              blocks={liveBlocks}
              comments={documentData.comments || []}
              disabled={previewIndex !== null}
              onAddComment={handleAddComment}
              onAnnotationSave={handleAnnotationSave}
              onClose={() => setActivePanel(null)}
              onFocusBlock={(blockId, pageId) => {
                focusBlock(blockId, pageId);
              }}
              session={session}
            />
          ) : null}
        </main>
      </div>

      <SlashCommandPalette
        commands={filteredCommands}
        onSelect={applySlashCommand}
        open={slashState.open}
        query={slashState.query}
        selectedIndex={slashState.selectedIndex}
      />

      {isPublishing ? (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/16 backdrop-blur-sm" data-testid="publish-loading-overlay">
          <div className="glass-panel flex items-center gap-3 rounded-lg px-6 py-3 text-slate-700">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            Publishing the shared cut...
          </div>
        </div>
      ) : null}
    </div>
  );
}