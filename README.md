# nce-learning
新概念英语在线点读，点句即读、连续播放、单词点读、课文点读，支持离线使用，适合英语初学者使用。

# 一、总体设计概览

## 1.1 技术栈矩阵

| 层级             | 技术     | 说明                           |
| ---------------- | -------- | ------------------------------ |
| 框架             | Vue 3 + Composition API (`<script setup lang="ts">`) | 推荐作为标准开发范式 |
| 构建             | Vite 5.x | 零配置 TS 支持，原生 Web Worker 处理 |
| 离线存储 | OPFS (Origin Private File System) | 高性能、大容量、不占用 IndexedDB 配额 |
| 缓存策略 | 首次 fetch → OPFS，后续读本地 | 核心逻辑在 Web Worker 中执行 |
| 音频播放 | Web Audio API | 精确到秒的 seek 控制 |
| 歌词格式 | LRC (单语 + 双语扩展) | 标准 [mm:ss.xx] 格式 |


## 1.2 项目结构

```text
nce-learning/
├── public/
│   └── resources/               # 首次访问时的 fallback 资源清单
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── PointReader.vue       # 核心点读组件
│   │   ├── SubtitleDisplay.vue   # 字幕展示（中英文上下排列）
│   │   ├── AudioProgress.vue     # 进度条/点读导航
│   │   └── LessonList.vue        # 课程列表
│   ├── composables/
│   │   ├── useOPFS.ts           # OPFS 封装（主线程 → Worker 通信）
│   │   ├── useAudio.ts          # Web Audio API 封装
│   │   ├── useLRC.ts            # LRC 解析 + 双语匹配
│   │   └── useCache.ts          # 缓存策略控制
│   ├── workers/
│   │   └── file-worker.ts       # Web Worker: OPFS 文件读写
│   ├── types/
│   │   └── index.ts             # LRCLine, CachedFile, AudioState 等类型
│   ├── utils/
│   │   └── lrc-parser.ts        # 纯函数 LRC 解析
│   ├── App.vue
│   └── main.ts
├── vite.config.ts
├── tsconfig.json
└── package.json
```

# 二、技术架构图

```mermaid
flowchart TB
    subgraph User["用户界面层"]
        A[课程列表] --> B[点读主界面]
        B --> C[字幕展示<br/>中/英/双语]
        B --> D[音频播放器]
    end

    subgraph Logic["核心逻辑层"]
        E[useOPFS<br/>与Worker通信]
        F[useAudio<br/>Web Audio API]
        G[useLRC<br/>双语LRC解析]
        H[useCache<br/>缓存策略]
    end

    subgraph Worker["Web Worker 线程"]
        I[file-worker.ts<br/>OPFS 读写操作]
        J[FileSystemDirectoryHandle]
        K[FileSystemFileHandle]
    end

    subgraph Storage["存储层"]
        L[(OPFS<br/>私有文件系统)]
        M[CDN / 在线资源]
    end

    B --> E
    B --> F
    B --> G
    E --> H
    E <--> I
    I <--> J
    J <--> K
    K <--> L
    H -->|首次访问| M
    H -->|后续访问| L
    F -->|播放控制| C
    G -->|字幕数据| C
  ```  