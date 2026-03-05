import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PublishedView() {
  const [documentData, setDocumentData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchDocument = async () => {
      try {
        const response = await axios.get(`${API}/document`);
        if (mounted) {
          setDocumentData(response.data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchDocument();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (documentData?.title) {
      document.title = `${documentData.title} — Published`;
    }
  }, [documentData?.title]);

  const pages = documentData?.pages || [];
  const blocks = documentData?.published_snapshot?.blocks || [];

  const groupedPages = useMemo(
    () =>
      pages.map((page) => ({
        ...page,
        blocks: blocks.filter((block) => block.page_id === page.id),
      })),
    [blocks, pages],
  );

  return (
    <div className="published-shell min-h-screen px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-[1040px] space-y-6">
        <div className="glass-panel flex flex-col gap-4 rounded-[1rem] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Published cut</p>
            <h1
              className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
              data-testid="published-document-title"
              style={{ fontFamily: '"Work Sans", sans-serif' }}
            >
              {documentData?.title || "Collaborative Canvas"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base" data-testid="published-document-subtitle">
              {documentData?.published_snapshot
                ? `${documentData.published_snapshot.label} · Published by ${documentData.published_snapshot.author}`
                : "The team has not published the document yet."}
            </p>
          </div>

          <Link data-testid="return-editor-link" to="/">
            <Button className="rounded-lg bg-slate-900 text-white hover:bg-slate-800" type="button">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to editor
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="glass-panel rounded-[1rem] p-8 text-center text-slate-500" data-testid="published-loading-state">
            Loading published view...
          </div>
        ) : documentData?.published_snapshot ? (
          <div className="space-y-5">
            {groupedPages.map((page) => (
              <motion.section
                className="paper-page rounded-[1rem] p-7"
                data-testid={`published-page-${page.id}`}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                key={page.id}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-400">{page.title}</p>
                    <p className="mt-2 text-sm text-slate-500">{page.subtitle}</p>
                  </div>
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: page.accent }} />
                </div>

                <div className="space-y-6">
                  {page.blocks.map((block) => (
                    <article data-testid={`published-block-${block.id}`} key={block.id}>
                      {block.type === "heading" ? (
                        <h2 className="text-3xl font-semibold tracking-tight text-slate-950" style={{ fontFamily: '"Work Sans", sans-serif' }}>
                          {block.content}
                        </h2>
                      ) : block.type === "quote" ? (
                        <blockquote className="border-l-2 border-slate-200 pl-4 text-lg font-medium italic leading-relaxed text-slate-700" style={{ fontFamily: '"Work Sans", sans-serif' }}>
                          {block.content}
                        </blockquote>
                      ) : block.type === "divider" ? (
                        <div className="space-y-2 py-3">
                          <div className="h-px bg-slate-200" />
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Turn the page</p>
                        </div>
                      ) : (
                        <p className={`text-slate-700 ${block.type === "list" ? "text-sm leading-7" : "text-base leading-8"}`}>
                          {block.content}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </motion.section>
            ))}
          </div>
        ) : (
          <div className="glass-panel rounded-[1rem] p-8 text-center text-slate-500" data-testid="published-empty-state">
            Nothing is published yet. Use the share / publish button in the editor to create the first shared cut.
          </div>
        )}
      </div>
    </div>
  );
}