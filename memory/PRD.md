# Collaborative Document Editor PRD

## Original Problem Statement
## APP 1: COLLABORATIVE DOCUMENT EDITOR

Build a rich collaborative document editor with the following mandatory frontend features:

**Presence & Awareness**
- Each collaborator has a color-coded animated cursor that smoothly glides across the page 
  with a small avatar/name label attached
- Show "ghost text" as collaborators type — translucent preview text that appears before 
  they commit a change
- Sections being edited by others should have a subtle pulsing color highlight in that 
  user's color
- A sidebar minimap shows where every collaborator is currently located in the document 
  with animated position indicators

**Canvas & Layout**
- Soft paper-textured canvas with realistic drop shadows on each page block
- Smooth zoom-to-fit animation when navigating between sections
- Margin annotations that appear as collapsed icons and expand into sticky-note-style 
  popouts on hover
- Page transitions that physically simulate turning a page

**Editing Experience**
- Slash `/` command palette with animated icon previews and fluid keyboard-navigable search
- Inline AI suggestions render as translucent ghost text that gently fades in; pressing Tab 
  accepts with a smooth fill animation
- Block-level drag handles with magnetic snapping to grid; reordering plays a satisfying 
  displacement animation on surrounding blocks
- Multi-block selection shows a unified glow effect that spans all selected elements

**Polish**
- Comment threads collapse/expand with accordion physics (spring-eased)
- Version history has a cinematic scrubbing timeline — drag it to visually "rewind" the 
  document state
- First share/publish triggers a tasteful confetti burst

## User Choices
- Real-time multi-user collaboration across browsers
- AI suggestions mocked for now (no live LLM)
- No login/open shared editor
- Bold cinematic / animated workspace
- Follow-up redesign: focused editor, side panels hidden until toggled, subtle motion only, clean light UI, sans serif typography
- Further refinement: history panel moved to the left side, reduced UI roundness, visible non-clipped annotations, and a simulated 2-person collaboration demo toggle
- Latest refinement: collaborative typing now uses a more Google Docs-style inline preview with collaborator label/caret, and non-typing cursors were cleaned toward a more compact Figma-like treatment
- Small UX fix: increased collaborator name-tag layering so inline typing labels render above document text cleanly
- Docs-like redesign: full toolbar/header, tighter document-centric layout, side comments instead of floating notes, and collaboration visuals closer to Google Docs
- Interaction polish: contextual AI suggestions by block type/page context, real dropdown menus for File/Edit/View/etc., working bold/italic/underline controls, and a repositioned page navigation row to avoid overlap
- AI behavior refinement: suggestions now follow the current writing flow more naturally, can be dismissed from a visible X action, and stay suppressed until new text is typed
- Layout refinement: the main editor now reads as one continuous Google Docs-style page, with the section names kept as subtle inline dividers instead of separate page blocks
- Title editing fix: the document name is now directly editable from the header, saves on Enter or blur, and updates anywhere the title is shown
- P0→P2 completion request for current backlog: finish new document flow, delete block flow, functional toolbar/menu controls, and resolve remaining header/panel UX gaps

## Architecture Decisions
- React frontend with route-based experience for live editor (`/`) and published read-only view (`/published`)
- FastAPI backend with MongoDB persistence for a single shared document, comments, annotations, versions, and published snapshot
- WebSocket collaboration channel at `/api/ws/document` for presence, cursor movement, typing previews, and live document sync
- Block-based document model to support drag reorder, slash commands, annotations, and version snapshots
- Focused light-mode editor layout with toggleable overview/comments/history panels and sans serif typography throughout
- History now uses a left-side rail pattern, and notes/comments are managed from a Docs-like side comments rail instead of floating sticky notes

## What’s Implemented
- Shared collaborative editor with seeded multi-page document, page switching, toggleable overview/comments/history panels, and published view
- Real-time presence with animated remote cursors, collaborator labels, ghost typing previews, and live editing highlights
- Rich editing interactions: slash command palette, mocked inline AI ghost suggestion + Tab accept, block drag/reorder, multi-block glow, sticky-note annotations, comments, and version restore timeline
- Share/publish flow with persistent published snapshot, success messaging, and confetti trigger on first publish
- Simplified visual system with sans serif headings/body, cleaner published view, reduced always-visible chrome, and softer motion
- Added a local 2-person collaboration preview mode that simulates cursors, ghost typing, editing highlights, and minimap movement without needing a second real collaborator
- Updated collaborative typing UX to render inline preview text at the edit point instead of a detached bubble, with compact collaborator labeling closer to familiar docs tools
- Added a Google Docs-inspired editor shell with a full toolbar/header, docked comments rail, document page canvas, and more familiar collaboration affordances
- Toolbar and menu controls now have real interactive behavior: dropdown options, block formatting toggles, block type switching, and smarter AI suggestion prompts
- Inline AI suggestion behavior now respects user intent better: dismiss stays dismissed for the current text, fresh typing re-enables suggestions, and suggestions are more context-aware within the active block
- Reworked the document canvas from segmented page sections into a single continuous writing surface while preserving section jump controls and collaboration behavior
- Added a real document title update flow with backend persistence and header inline rename behavior
- Backend API coverage plus websocket smoke coverage enabled through pytest suite
- Added `POST /api/document` to create/reset a fresh blank collaborative document from the editor
- Added `DELETE /api/document/block/{block_id}` with safe last-block fallback + associated comment cleanup
- Wired frontend end-to-end for New Document and Delete Block (File menu + per-block delete action)
- Upgraded toolbar formatting behavior so block style/font/size changes persist in backend block schema (`styles`, `font_family`, `font_size`)
- Expanded File/Edit/View menu actions (new/save/print, undo/redo, copy/paste/cut, panel collapse)
- Added left-rail close controls for minimap/history and improved header layout wrapping to avoid overlap

## Prioritized Backlog
### P0
- Add stale collaborator cleanup/heartbeat hardening for long-lived or abruptly closed browser sessions
- Add richer conflict resolution for simultaneous block edits (currently optimistic whole-document sync, not CRDT/OT)

### P1
- Add rich text **inline selection** formatting (current formatting is block-level, not span-level)
- Add true multi-document management (current New Document resets the shared-canvas document)
- Add persistent author display/history metadata per version and per block update

### P2
- Upgrade MOCKED AI suggestions to live LLM-backed inline assistance
- Improve collaborator caret precision + minimap fidelity to better match Google Docs behavior
- Add collaborative comment resolution, inline thread anchors, and deeper annotation linking

## Next Tasks
- Integrate real LLM-backed inline suggestions (currently MOCKED) once provider/model is confirmed
- Harden realtime multi-user behavior for stale sessions and simultaneous edits
- Add inline rich-text span formatting for Docs-like bold/italic/underline on selected text