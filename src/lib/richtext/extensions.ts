import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { IssueHighlight } from "@/lib/richtext/issueHighlight";
import { MatchHighlight } from "@/lib/richtext/matchHighlight";
import { SentenceHighlight } from "@/lib/richtext/sentenceHighlight";

/**
 * One document schema for every VeriWrite tool, built in one place so a surface
 * cannot quietly gain a node the detection engine would then have to guess about.
 *
 * Headings stop at level 3 and the document set is the StarterKit default: the tools
 * analyse prose, so anything beyond a heading, a list, a quote, a link and inline
 * marks would only give users formatting the analysis cannot see.
 */
export function detectorExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      },
    }),
    Placeholder.configure({
      placeholder,
      showOnlyWhenEditable: true,
      showOnlyCurrent: true,
    }),
    // Marks are decorations, never document content, so highlighting cannot change
    // the stored draft or the text the engine reads.
    SentenceHighlight,
    IssueHighlight,
    MatchHighlight,
  ];
}
