/** FileManager - ファイルツリーと内容プレビュー・編集 */

import { useEffect, useState } from "react";
import { File, Folder, ChevronRight, ChevronDown, Save } from "lucide-react";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

/** ファイルツリーのノードコンポーネント（再帰） */
function FileTreeNode({
  node,
  onSelect,
  selectedPath,
  depth,
}: {
  node: FileNode;
  onSelect: (path: string) => void;
  selectedPath: string | null;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1);

  if (node.type === "directory") {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 w-full text-left py-0.5 px-1 rounded text-xs transition-colors"
          style={{
            color: "#9ba5bc",
            paddingLeft: `${4 + depth * 12}px`,
          }}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Folder size={12} />
          <span>{node.name}</span>
        </button>
        {expanded && node.children?.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            onSelect={onSelect}
            selectedPath={selectedPath}
            depth={depth + 1}
          />
        ))}
      </div>
    );
  }

  const isSelected = node.path === selectedPath;
  return (
    <button
      onClick={() => onSelect(node.path)}
      className="flex items-center gap-1 w-full text-left py-0.5 px-1 rounded text-xs transition-colors"
      style={{
        color: isSelected ? "#e8ecf4" : "#9ba5bc",
        background: isSelected ? "#2a3045" : "transparent",
        paddingLeft: `${4 + depth * 12}px`,
      }}
    >
      <File size={12} />
      <span>{node.name}</span>
    </button>
  );
}

/** ファイル管理画面 */
export function FileManager() {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    fetch("/api/files")
      .then((r) => r.json())
      .then((data) => setTree(data as FileNode[]))
      .catch(console.error);
  }, []);

  const handleSelect = async (filePath: string) => {
    setSelectedPath(filePath);
    setIsDirty(false);
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(filePath)}`);
      const data = await res.json() as { content: string };
      setContent(data.content);
    } catch (err) {
      console.error("ファイル読み込みエラー:", err);
      setContent("");
    }
  };

  const handleSave = async () => {
    if (!selectedPath) return;
    try {
      await fetch(`/api/files/${encodeURIComponent(selectedPath)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setIsDirty(false);
    } catch (err) {
      console.error("ファイル保存エラー:", err);
    }
  };

  return (
    <div className="flex h-full">
      {/* ファイルツリー */}
      <div
        className="w-56 flex-shrink-0 overflow-y-auto border-r p-2"
        style={{ background: "#1a1e28", borderColor: "#2a3045" }}
      >
        <p className="text-xs font-semibold mb-2 px-1" style={{ fontFamily: "'Syne', sans-serif", color: "#e8ecf4" }}>
          Files
        </p>
        {tree.map((node) => (
          <FileTreeNode
            key={node.path}
            node={node}
            onSelect={handleSelect}
            selectedPath={selectedPath}
            depth={0}
          />
        ))}
      </div>

      {/* エディタエリア */}
      <div className="flex-1 flex flex-col">
        {selectedPath ? (
          <>
            <div
              className="flex items-center justify-between px-3 py-2 border-b"
              style={{ borderColor: "#2a3045", background: "#1a1e28" }}
            >
              <span className="text-xs" style={{ color: "#9ba5bc" }}>{selectedPath}</span>
              {isDirty && (
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                  style={{ background: "#4f8ef7", color: "#fff" }}
                >
                  <Save size={10} />
                  保存
                </button>
              )}
            </div>
            <textarea
              value={content}
              onChange={(e) => { setContent(e.target.value); setIsDirty(true); }}
              className="flex-1 resize-none outline-none p-3 font-mono text-xs"
              style={{ background: "#0d0f14", color: "#e8ecf4", border: "none" }}
              spellCheck={false}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full" style={{ color: "#9ba5bc" }}>
            <p className="text-sm">ファイルを選択してください</p>
          </div>
        )}
      </div>
    </div>
  );
}
