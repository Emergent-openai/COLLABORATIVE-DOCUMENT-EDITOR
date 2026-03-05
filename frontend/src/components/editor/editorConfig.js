import { AlignLeft, Heading1, List, Minus, Quote, Sparkles } from "lucide-react";

export const collaboratorColors = [
  "#FF0080",
  "#00CC99",
  "#FFB020",
  "#7928CA",
  "#0070F3",
];

export const collaboratorAvatars = [
  "https://images.unsplash.com/photo-1520529277867-dbf8c5e0b340?crop=entropy&cs=srgb&fm=jpg&q=85",
  "https://images.unsplash.com/photo-1712168567852-ea607c2d3177?crop=entropy&cs=srgb&fm=jpg&q=85",
  "https://images.unsplash.com/photo-1679466061812-211a6b737175?crop=entropy&cs=srgb&fm=jpg&q=85",
];

const collaborativeNames = [
  "Nova Lane",
  "Iris Vale",
  "Theo Hart",
  "Mila Stone",
  "Rin Sol",
  "Luca North",
  "Ari Bloom",
  "Jules Ember",
];

export const blockPlaceholders = {
  heading: "Write a cinematic heading...",
  paragraph: "Write the next beat of the document...",
  quote: "Capture the line everyone remembers...",
  list: "List the next moves, one per line...",
  divider: "Section divider",
};

export const pageAuraMap = {
  "page-1": "from-[#fff5ea] via-white to-[#ffe8f5]",
  "page-2": "from-[#f1edff] via-white to-[#edf6ff]",
  "page-3": "from-[#edf8f2] via-white to-[#fff6dc]",
};

export const commandOptions = [
  {
    id: "paragraph",
    label: "Paragraph",
    description: "Continue the shared narrative with flexible body copy.",
    icon: AlignLeft,
    type: "paragraph",
    placeholder: blockPlaceholders.paragraph,
  },
  {
    id: "heading",
    label: "Heading",
    description: "Introduce a bold section title with cinematic weight.",
    icon: Heading1,
    type: "heading",
    placeholder: blockPlaceholders.heading,
  },
  {
    id: "quote",
    label: "Quote",
    description: "Pull a dramatic line forward in the draft.",
    icon: Quote,
    type: "quote",
    placeholder: blockPlaceholders.quote,
  },
  {
    id: "list",
    label: "List",
    description: "Turn the section into clear actions or beats.",
    icon: List,
    type: "list",
    placeholder: blockPlaceholders.list,
  },
  {
    id: "divider",
    label: "Divider",
    description: "Create a pause before the next scene lands.",
    icon: Minus,
    type: "divider",
    placeholder: blockPlaceholders.divider,
  },
  {
    id: "spark",
    label: "AI Spark",
    description: "Keep the current block and surface a fresh AI prompt.",
    icon: Sparkles,
    type: "paragraph",
    placeholder: blockPlaceholders.paragraph,
  },
];

export function createLocalSession() {
  if (typeof window === "undefined") {
    return {
      session_id: "local-preview",
      name: "Nova Lane",
      color: collaboratorColors[0],
      avatar_url: collaboratorAvatars[0],
    };
  }

  const stored = window.localStorage.getItem("collaborative-canvas-session");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      window.localStorage.removeItem("collaborative-canvas-session");
    }
  }

  const session = {
    session_id: window.crypto?.randomUUID?.() || `session-${Date.now()}`,
    name: collaborativeNames[Math.floor(Math.random() * collaborativeNames.length)],
    color:
      collaboratorColors[Math.floor(Math.random() * collaboratorColors.length)],
    avatar_url:
      collaboratorAvatars[Math.floor(Math.random() * collaboratorAvatars.length)],
  };

  window.localStorage.setItem(
    "collaborative-canvas-session",
    JSON.stringify(session),
  );

  return session;
}

export function toWebSocketUrl(backendUrl) {
  return `${backendUrl.replace(/^http/, "ws")}/api/ws/document`;
}

export function buildPublishedUrl() {
  if (typeof window === "undefined") {
    return "/published";
  }

  return `${window.location.origin}/published`;
}

export function buildNewBlock(pageId, type = "paragraph") {
  return {
    id: globalThis.crypto?.randomUUID?.() || `block-${Date.now()}`,
    page_id: pageId,
    section: "New Scene",
    type,
    content: "",
    annotation: "",
    placeholder: blockPlaceholders[type] || blockPlaceholders.paragraph,
    styles: [],
    font_family: "Inter",
    font_size: 14,
    updated_at: new Date().toISOString(),
  };
}

function normalizeSuggestionSeed(value = "") {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashSeed(value = "") {
  return Array.from(value).reduce(
    (total, character, index) => total + character.charCodeAt(0) * (index + 1),
    0,
  );
}

function pickSuggestionOption(options, seedText, content) {
  if (!options.length) {
    return null;
  }

  const normalizedContent = normalizeSuggestionSeed(content);
  const seedIndex = hashSeed(seedText || content) % options.length;

  for (let offset = 0; offset < options.length; offset += 1) {
    const option = options[(seedIndex + offset) % options.length];
    const sentence = normalizeSuggestionSeed(option.sentence || option);
    const continuation = normalizeSuggestionSeed(option.continuation || option);

    if (
      !sentence ||
      (!normalizedContent.includes(sentence) && !normalizedContent.includes(continuation))
    ) {
      return option;
    }
  }

  return options[seedIndex];
}

function getLastMeaningfulSentence(content = "") {
  const parts = content
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return content.trim();
  }

  return parts[parts.length - 1];
}

function endsWithSentencePunctuation(content = "") {
  return /[.!?]["')\]]*$/.test(content.trim());
}

const paragraphSuggestionLibrary = {
  presence: [
    {
      sentence:
        "Another collaborator should be able to tell who is drafting and where attention is gathering before the sentence is committed.",
      continuation:
        " so another collaborator can tell who is drafting and where attention is gathering before the sentence is committed.",
    },
    {
      sentence:
        "That shared awareness should make the document feel alive without turning it into noise.",
      continuation:
        ", making the shared awareness feel alive without turning it into noise.",
    },
    {
      sentence:
        "Every new cursor should clarify the moment instead of pulling the reader out of it.",
      continuation:
        " while keeping every new cursor helpful instead of distracting.",
    },
  ],
  feedback: [
    {
      sentence:
        "The feedback should stay close enough to the passage that the next revision feels obvious.",
      continuation:
        " so the feedback stays close enough to the passage that the next revision feels obvious.",
    },
    {
      sentence:
        "Comments should sharpen the next draft instead of sending the writer hunting for context.",
      continuation:
        ", letting the comment sharpen the next draft without sending the writer hunting for context.",
    },
    {
      sentence:
        "A useful note should tell the writer what to change and why it matters.",
      continuation:
        " while making it clear what should change and why it matters.",
    },
  ],
  publish: [
    {
      sentence:
        "The handoff should feel calm and final, with no doubt about who approves the next step.",
      continuation:
        " so the handoff feels calm and final, with no doubt about who approves the next step.",
    },
    {
      sentence:
        "Once this is shared, the reader should know exactly what is ready and what still needs review.",
      continuation:
        ", making it obvious what is ready and what still needs review once the draft is shared.",
    },
    {
      sentence:
        "Publishing should read like a clean handoff rather than another round of edits.",
      continuation:
        " so publishing reads like a clean handoff rather than another round of edits.",
    },
  ],
  layout: [
    {
      sentence:
        "The page should stay calm enough to read while still showing that several people are shaping it at once.",
      continuation:
        " while keeping the page calm enough to read even as several people shape it at once.",
    },
    {
      sentence:
        "Each block should guide the eye forward without hiding the collaboration around it.",
      continuation:
        ", letting each block guide the eye forward without hiding the collaboration around it.",
    },
    {
      sentence:
        "The layout should make revision feel structured instead of mechanical.",
      continuation:
        " so the layout makes revision feel structured instead of mechanical.",
    },
  ],
  opening: [
    {
      sentence:
        "The next line should make the second collaborator feel present from the moment they arrive.",
      continuation:
        " so the second collaborator feels present from the moment they arrive.",
    },
    {
      sentence:
        "This opening lands best when the reader can picture another person entering the page in real time.",
      continuation:
        ", especially if the reader can picture another person entering the page in real time.",
    },
    {
      sentence:
        "The first paragraph should turn shared presence into something the reader can almost see.",
      continuation:
        " while turning shared presence into something the reader can almost see.",
    },
  ],
  working: [
    {
      sentence:
        "The next sentence should make ownership and momentum easier to scan.",
      continuation:
        " so ownership and momentum are easier to scan on the next read.",
    },
    {
      sentence:
        "Keep the revision flow concrete so the team can tell what changed and what comes next.",
      continuation:
        ", keeping the revision flow concrete enough for the team to tell what changed and what comes next.",
    },
    {
      sentence:
        "This draft feels strongest when the next line clarifies who is doing what now.",
      continuation:
        " while clarifying who is doing what now.",
    },
  ],
  launch: [
    {
      sentence:
        "The next sentence should make the handoff feel settled and trustworthy.",
      continuation:
        " so the handoff feels settled and trustworthy.",
    },
    {
      sentence:
        "This section lands better when the final reviewer and next step are explicit.",
      continuation:
        ", especially if the final reviewer and next step are explicit.",
    },
    {
      sentence:
        "The ending should sound confident enough that the team knows the draft is ready to move.",
      continuation:
        " while sounding confident enough that the team knows the draft is ready to move.",
    },
  ],
  default: [
    {
      sentence:
        "The next sentence should carry the same idea forward with one more concrete detail.",
      continuation:
        " with one more concrete detail that carries the same idea forward.",
    },
    {
      sentence:
        "Keep the thought moving by showing what the reader should notice next.",
      continuation:
        ", keeping the thought moving by showing what the reader should notice next.",
    },
    {
      sentence:
        "A short follow-up line here would make the point feel more complete.",
      continuation:
        " so the point feels more complete on the next line.",
    },
  ],
};

const headingSuggestionLibrary = {
  opening: [
    " — before the second cursor even blinks",
    " — from the first shared keystroke",
    " — the moment another writer arrives",
  ],
  working: [
    " that still reads clearly under revision",
    " the team can scan at a glance",
    " while the draft stays in motion",
  ],
  launch: [
    " before the final handoff begins",
    " with a handoff the team can trust",
    " once the last approval lands",
  ],
  presence: [
    " — with presence you can read at a glance",
    " when every collaborator feels visible",
    " as the page wakes up around the team",
  ],
  feedback: [
    " — with comments that stay close to the text",
    " when revision stays attached to the line",
    " and feedback never drifts away from the draft",
  ],
  layout: [
    " without losing the calm of the page",
    " while the document stays easy to scan",
    " and the structure still feels quiet",
  ],
  default: [
    " that feels clearer on the next read",
    " the next collaborator can enter quickly",
    " while the draft keeps moving forward",
  ],
};

const quoteSuggestionLibrary = {
  presence: [
    " — and everyone in the room can feel it.",
    " — even before the next edit is committed.",
    " — right there in the movement of the page.",
  ],
  publish: [
    " — right before the final handoff.",
    " — in a way the final reviewer can trust.",
    " — without another round of cleanup.",
  ],
  default: [
    " — and the reader should feel that too.",
    " — in a way that stays with the next draft.",
    " — before the page settles again.",
  ],
};

const listSuggestionLibrary = {
  presence: [
    "\n• Make the next collaborator visible before they type.",
    "\n• Let the team see where attention is moving.",
    "\n• Keep ghost typing readable but quiet.",
  ],
  feedback: [
    "\n• Keep feedback attached to the exact passage it changes.",
    "\n• Make the next revision obvious from the note itself.",
    "\n• Let comments narrow the decision, not widen it.",
  ],
  publish: [
    "\n• Name the final reviewer before sharing the link.",
    "\n• Clarify what is final and what is still pending.",
    "\n• Treat publish as a handoff, not another draft pass.",
  ],
  default: [
    "\n• Add one more step that keeps the flow moving.",
    "\n• Name the next action in plain language.",
    "\n• Clarify who picks this up next.",
  ],
};

function resolveSuggestionTopic(content, pageTitle) {
  const normalizedContent = normalizeSuggestionSeed(content);
  const normalizedPageTitle = normalizeSuggestionSeed(pageTitle);

  if (/\b(comment|note|feedback|review|reply|thread)\b/.test(normalizedContent)) {
    return "feedback";
  }

  if (/\b(publish|share|handoff|launch|final|approval|reviewer)\b/.test(normalizedContent)) {
    return "publish";
  }

  if (/\b(page|canvas|layout|section|block|paper)\b/.test(normalizedContent)) {
    return "layout";
  }

  if (/\b(cursor|caret|presence|collaborat|typing|ghost|minimap)\b/.test(normalizedContent)) {
    return "presence";
  }

  if (normalizedPageTitle.includes("opening")) {
    return "opening";
  }

  if (normalizedPageTitle.includes("working")) {
    return "working";
  }

  if (normalizedPageTitle.includes("launch")) {
    return "launch";
  }

  return "default";
}

export function buildAiSuggestion(block, pageTitle) {
  if (!block?.content?.trim()) {
    return "";
  }

  const content = block.content.trim().replace(/\s+/g, " ");
  const topic = resolveSuggestionTopic(content, pageTitle);
  const seedText = getLastMeaningfulSentence(content) || content;
  const sentenceComplete = endsWithSentencePunctuation(content);

  if (block.type === "heading") {
    const headingOptions =
      headingSuggestionLibrary[topic] || headingSuggestionLibrary.default;
    const picked = pickSuggestionOption(
      headingOptions.map((option) => ({ sentence: option, continuation: option })),
      seedText,
      content,
    );
    if (!picked) {
      return "";
    }
    return picked.sentence;
  }

  if (block.type === "paragraph") {
    const paragraphOptions =
      paragraphSuggestionLibrary[topic] || paragraphSuggestionLibrary.default;
    const picked = pickSuggestionOption(paragraphOptions, seedText, content);
    if (!picked) {
      return "";
    }
    return sentenceComplete ? ` ${picked.sentence}` : picked.continuation;
  }

  if (block.type === "quote") {
    const quoteOptions = quoteSuggestionLibrary[topic] || quoteSuggestionLibrary.default;
    const picked = pickSuggestionOption(
      quoteOptions.map((option) => ({ sentence: option, continuation: option })),
      seedText,
      content,
    );
    return picked?.sentence || "";
  }

  if (block.type === "list") {
    const listOptions = listSuggestionLibrary[topic] || listSuggestionLibrary.default;
    const picked = pickSuggestionOption(
      listOptions.map((option) => ({ sentence: option, continuation: option })),
      seedText,
      content,
    );
    return picked?.sentence || "";
  }

  return "";
}

export function getGhostSuffix(currentContent, previewContent) {
  if (!previewContent) {
    return "";
  }

  if (!currentContent) {
    return previewContent;
  }

  if (previewContent.startsWith(currentContent)) {
    return previewContent.slice(currentContent.length);
  }

  return ` ${previewContent}`;
}

export function buildRemoteTypingPreview(currentContent = "", previewContent = "") {
  if (!previewContent) {
    return null;
  }

  if (currentContent === previewContent) {
    return {
      prefix: currentContent,
      inserted: "",
      suffix: "",
    };
  }

  if (previewContent.startsWith(currentContent)) {
    return {
      prefix: currentContent,
      inserted: previewContent.slice(currentContent.length),
      suffix: "",
    };
  }

  if (currentContent.startsWith(previewContent)) {
    return {
      prefix: previewContent,
      inserted: "",
      suffix: currentContent.slice(previewContent.length),
    };
  }

  let prefixLength = 0;
  while (
    prefixLength < currentContent.length &&
    prefixLength < previewContent.length &&
    currentContent[prefixLength] === previewContent[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  const currentRemainder = currentContent.length - prefixLength;
  const previewRemainder = previewContent.length - prefixLength;

  while (
    suffixLength < currentRemainder &&
    suffixLength < previewRemainder &&
    currentContent[currentContent.length - 1 - suffixLength] ===
      previewContent[previewContent.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  if (prefixLength < Math.max(6, Math.floor(currentContent.length * 0.4))) {
    return {
      prefix: currentContent,
      inserted: "",
      suffix: "",
    };
  }

  return {
    prefix: currentContent.slice(0, prefixLength),
    inserted: previewContent.slice(prefixLength, previewContent.length - suffixLength),
    suffix: suffixLength ? currentContent.slice(currentContent.length - suffixLength) : "",
  };
}