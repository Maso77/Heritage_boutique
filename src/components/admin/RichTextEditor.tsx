import React, { useEffect, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Code2, Heading2, Image, Italic, Link, List, ListOrdered, Maximize2, Minimize2, Quote, Redo2, RemoveFormatting, Table2, Underline, Undo2 } from 'lucide-react';

interface RichTextEditorProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}

const toolbar = [
  { command: 'bold', label: 'Gras', icon: Bold },
  { command: 'italic', label: 'Italique', icon: Italic },
  { command: 'underline', label: 'Souligné', icon: Underline },
  { command: 'formatBlock', value: 'h2', label: 'Titre', icon: Heading2 },
  { command: 'insertUnorderedList', label: 'Liste à puces', icon: List },
  { command: 'insertOrderedList', label: 'Liste numérotée', icon: ListOrdered },
  { command: 'formatBlock', value: 'blockquote', label: 'Citation', icon: Quote },
  { command: 'justifyLeft', label: 'Aligner à gauche', icon: AlignLeft },
  { command: 'justifyCenter', label: 'Centrer', icon: AlignCenter },
  { command: 'justifyRight', label: 'Aligner à droite', icon: AlignRight },
  { command: 'createLink', label: 'Lien', icon: Link },
  { command: 'undo', label: 'Annuler', icon: Undo2 },
  { command: 'redo', label: 'Rétablir', icon: Redo2 },
  { command: 'removeFormat', label: 'Retirer le format', icon: RemoveFormatting },
  { command: 'formatBlock', value: 'pre', label: 'Bloc de code', icon: Code2 }
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ id, label, value, onChange, hint }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value;
  }, [value]);

  const execute = (command: string, commandValue?: string) => {
    if (command === 'createLink') {
      const url = window.prompt('Adresse du lien, par exemple https://…');
      if (!url) return;
      document.execCommand(command, false, url);
    } else if (command === 'insertImage') {
      const url = window.prompt('URL de l’image déjà ajoutée dans la Galerie média :');
      if (!url || !/^https?:\/\//i.test(url)) return;
      const alt = window.prompt('Texte alternatif de l’image :') || '';
      document.execCommand('insertHTML', false, `<img src="${url.replace(/"/g, '&quot;')}" alt="${alt.replace(/"/g, '&quot;')}" />`);
    } else if (command === 'insertTable') {
      const rows = Math.max(1, Math.min(10, Number(window.prompt('Nombre de lignes', '2')) || 2));
      const columns = Math.max(1, Math.min(8, Number(window.prompt('Nombre de colonnes', '2')) || 2));
      const table = `<table><tbody>${Array.from({ length: rows }, () => `<tr>${Array.from({ length: columns }, () => '<td>&nbsp;</td>').join('')}</tr>`).join('')}</tbody></table><p><br></p>`;
      document.execCommand('insertHTML', false, table);
    } else {
      document.execCommand(command, false, commandValue);
    }
    editorRef.current?.focus();
    onChange(editorRef.current?.innerHTML || '');
  };

  return (
    <div className={fullscreen ? 'fixed inset-4 z-[70] overflow-y-auto bg-[#FAF9F7] p-4 shadow-2xl' : ''}>
      <label htmlFor={id} className="text-sm font-semibold text-[#002141]">{label}</label>
      {hint && <p className="mt-1 text-xs leading-relaxed text-[#3A3A3A]">{hint}</p>}
      <div className="mt-2 overflow-hidden border border-[#002141]/20 bg-white focus-within:border-[#AC854B] focus-within:ring-2 focus-within:ring-[#AC854B]/20">
        <div className="flex flex-wrap gap-1 border-b border-[#002141]/15 bg-[#FAF9F7] p-2" role="toolbar" aria-label={`Outils pour ${label}`}>
          {toolbar.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={`${item.command}-${item.label}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => execute(item.command, item.value)}
                className="flex h-9 w-9 items-center justify-center text-[#002141] transition hover:bg-[#D6BB8F]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#AC854B]"
                aria-label={item.label}
                title={item.label}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            );
          })}
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => execute('insertImage')} className="flex h-9 w-9 items-center justify-center text-[#002141] transition hover:bg-[#D6BB8F]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#AC854B]" aria-label="Insérer une image depuis la galerie" title="Insérer une image depuis la galerie"><Image className="h-4 w-4" aria-hidden="true" /></button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => execute('insertTable')} className="flex h-9 w-9 items-center justify-center text-[#002141] transition hover:bg-[#D6BB8F]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#AC854B]" aria-label="Insérer un tableau" title="Insérer un tableau"><Table2 className="h-4 w-4" aria-hidden="true" /></button>
          <button type="button" onClick={() => setFullscreen((current) => !current)} className="ml-auto flex h-9 w-9 items-center justify-center text-[#002141] transition hover:bg-[#D6BB8F]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#AC854B]" aria-label={fullscreen ? 'Quitter le plein écran' : 'Plein écran'} title={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}>{fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
        </div>
        <div
          ref={editorRef}
          id={id}
          role="textbox"
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          onInput={(event) => onChange((event.currentTarget as HTMLDivElement).innerHTML)}
          className={`admin-rich-editor min-h-56 px-4 py-3 text-sm leading-7 text-[#3A3A3A] outline-none ${fullscreen ? 'min-h-[65vh]' : ''}`}
        />
      </div>
      <p className="mt-2 text-right text-xs text-[#3A3A3A]">{value.replace(/<[^>]+>/g, '').trim().length} caractères</p>
    </div>
  );
};
