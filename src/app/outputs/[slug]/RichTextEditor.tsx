'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Markdown } from 'tiptap-markdown';

interface RichTextEditorProps {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
}

export default function RichTextEditor({ initialMarkdown, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
      Markdown.configure({ html: false, transformPastedText: true }),
    ],
    content: initialMarkdown,
    immediatelyRender: false,
    onUpdate({ editor: e }) {
      // tiptap-markdown adds `.markdown` to storage at runtime; not reflected in Tiptap's Storage type.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange((e.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown());
    },
  });

  if (!editor) return null;

  function setLink() {
    const prev = editor!.getAttributes('link').href as string ?? '';
    const url = window.prompt('URL', prev);
    if (url === null) return;
    if (url === '') {
      editor!.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor!.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }

  return (
    <div className="rich-editor">
      <div className="rich-editor__toolbar">
        <button
          type="button"
          className={`rich-editor__btn${editor.isActive('bold') ? ' is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >B</button>
        <button
          type="button"
          className={`rich-editor__btn${editor.isActive('italic') ? ' is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        ><em>I</em></button>
        <span className="rich-editor__sep" />
        <button
          type="button"
          className={`rich-editor__btn${editor.isActive('heading', { level: 1 }) ? ' is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1"
        >H1</button>
        <button
          type="button"
          className={`rich-editor__btn${editor.isActive('heading', { level: 2 }) ? ' is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >H2</button>
        <button
          type="button"
          className={`rich-editor__btn${editor.isActive('heading', { level: 3 }) ? ' is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
        >H3</button>
        <span className="rich-editor__sep" />
        <button
          type="button"
          className={`rich-editor__btn${editor.isActive('bulletList') ? ' is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >• List</button>
        <button
          type="button"
          className={`rich-editor__btn${editor.isActive('orderedList') ? ' is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >1. List</button>
        <span className="rich-editor__sep" />
        <button
          type="button"
          className={`rich-editor__btn${editor.isActive('blockquote') ? ' is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Blockquote"
        >&ldquo;</button>
        <button
          type="button"
          className={`rich-editor__btn${editor.isActive('code') ? ' is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Inline code"
        >{`<>`}</button>
        <span className="rich-editor__sep" />
        <button
          type="button"
          className={`rich-editor__btn${editor.isActive('link') ? ' is-active' : ''}`}
          onClick={setLink}
          title="Link"
        >Link</button>
        <button
          type="button"
          className="rich-editor__btn"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal rule"
        >—</button>
      </div>
      <EditorContent editor={editor} className="rich-editor__content prose" />
    </div>
  );
}
