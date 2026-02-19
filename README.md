# Block-Based Markdown Editor
# ブロックベースMarkdownエディタ

A simple but powerful block-based Markdown editor built with Svelte and TypeScript. This project is an experiment in creating a Notion-like editing experience where each line or block (paragraph, heading, code block) is an independent unit.
SvelteとTypeScriptで構築された、シンプルかつ強力なブロックベースのMarkdownエディタです。このプロジェクトは、各行やブロック（段落、見出し、コードブロックなど）が独立した単位として扱われる、Notionのような編集体験の実現を目指した実験的なものです。

## Features
## 機能

- **Line-by-Line Editing**: Each line is a separate `textarea`, allowing for focused editing.
    - 各行を独立した`textarea`として編集できます。
- **Seamless Markdown Preview**: Markdown syntax is rendered beautifully when you're not editing a line, providing a clean reading experience.
    - 行を編集していないときは、Markdown構文が美しくレンダリングされ、クリーンな読書体験を提供します。
- **Code Block Editing**: Create fenced code blocks (e.g., `` ```javascript ``) that provide a dedicated multi-line editing area with a side-by-side, syntax-highlighted preview pane.
    - フェンス付きコードブロック（例: `` ```javascript ``）を作成すると、専用の複数行編集エリアと、シンタックスハイライトされたサイドバイサイドのプレビューペインが表示されます。
- **Keyboard-First Navigation**:
    - `Enter`: Create a new line or split the current one. On an empty list item, it de-indents or removes the list marker.
    - `Backspace`: At the beginning of a line, it merges with the line above.
    - `ArrowUp`/`ArrowDown`: Navigate between lines.
    - `Tab`/`Shift+Tab`: Indent and de-indent list items.
    - キーボードでの操作を重視:
        - `Enter`: 新しい行を作成または現在の行を分割します。空のリスト項目では、インデントを解除するかリストマーカーを削除します。
        - `Backspace`: 行の先頭で押すと、前の行と結合します。
        - `ArrowUp`/`ArrowDown`: 行間を移動します。
        - `Tab`/`Shift+Tab`: リスト項目のインデントと解除を行います。
- **Syntax Highlighting**: Code blocks are highlighted using [highlight.js](https://highlightjs.org/).
    - コードブロックは[highlight.js](https://highlightjs.org/)でシンタックスハイライトされます。
- **Diagrams**: Mermaid diagrams are supported.
    - Mermaid図がサポートされています。

## Tech Stack
## 技術スタック

- [Svelte](https://svelte.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [highlight.js](https://highlightjs.org/) for code syntax highlighting. (コードのシンタックスハイライト用)
- [Mermaid](https://mermaid.js.org/) for rendering diagrams. (図のレンダリング用)

## Getting Started
## はじめに

### Prerequisites
### 前提条件

- [Node.js](https://nodejs.org/) (version 18 or later recommended)
    - Node.js (バージョン18以降を推奨)

### Installation & Running
### インストールと実行

1.  **Install dependencies:**
    依存関係をインストールします。
    ```bash
    npm install
    ```

2.  **Run the development server:**
    開発サーバーを起動します。
    ```bash
    npm run dev
    ```
    Open your browser and navigate to the local server address provided (usually `http://localhost:5173`).
    ブラウザで表示されたローカルサーバーのアドレス（通常 `http://localhost:5173`）にアクセスしてください。

## Project Structure
## プロジェクト構成

- `src/App.svelte`: The main application wrapper.
    - メインアプリケーションのラッパーコンポーネント。
- `src/TextEditor.svelte`: The core component that manages all the lines and orchestrates the editing logic.
    - すべての行を管理し、編集ロジックを調整するコアコンポーネント。
- `src/lib/Line.svelte`: A component representing a single line in the editor. It handles both the preview state and the editing state (`textarea`).
    - エディタの単一行を表すコンポーネント。プレビュー状態と編集状態 (`textarea`) の両方を扱います。
- `src/lib/editor-utils.ts`: A set of utility functions for rendering Markdown, parsing lines, etc.
    - Markdownのレンダリング、行の解析などを行うユーティリティ関数群。
- `src/lib/types.ts`: TypeScript type definitions for the project.
    - プロジェクトのTypeScript型定義。
